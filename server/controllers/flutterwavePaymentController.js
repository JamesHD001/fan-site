const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const { initializeDeposit, verifyDeposit } = require("../services/flutterwaveProvider");
const { settleSuccessfulPayment } = require("../services/paymentSettlementService");

const getNgnPerUsdRate = () => {
  const rate = Number(process.env.FLUTTERWAVE_NGN_PER_USD_RATE);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("FLUTTERWAVE_NGN_PER_USD_RATE is not configured.");
  return rate;
};

const createFlutterwaveDeposit = async (req, res) => {
  try {
    const originalAmount = Number(req.body.amount);
    if (!Number.isInteger(originalAmount) || originalAmount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive integer in USD minor units." });
    }

    const exchangeRate = getNgnPerUsdRate();
    const amountNgnMajor = Math.ceil((originalAmount / 100) * exchangeRate);
    const reference = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const payment = await Payment.create({
      user: req.user._id,
      reference,
      type: "DEPOSIT",
      amount: amountNgnMajor,
      originalAmount,
      originalCurrency: "USD",
      currency: "NGN",
      exchangeRate,
      provider: "FLUTTERWAVE",
      status: "PENDING",
    });

    try {
      const checkout = initializeDeposit({
        amountMajor: amountNgnMajor,
        currency: "NGN",
        reference,
        email: req.user.email,
        name: req.user.name || `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
        metadata: { paymentId: payment._id.toString(), userId: req.user._id.toString(), type: "DEPOSIT" },
      });

      payment.providerResponse = checkout;
      await payment.save();

      return res.status(201).json({
        success: true,
        paymentId: payment._id,
        reference,
        checkout: {
          publicKey: checkout.publicKey,
          reference: checkout.reference,
          amount: checkout.amount,
          currency: checkout.currency,
          paymentOptions: checkout.paymentOptions,
          payloadHash: checkout.payloadHash,
          customer: checkout.customer,
        },
      });
    } catch (error) {
      payment.status = "FAILED";
      payment.providerResponse = { message: error.message };
      await payment.save();
      throw error;
    }
  } catch (error) {
    console.error("Flutterwave deposit initialization error:", error);
    return res.status(500).json({ success: false, message: "Unable to initialize wallet funding." });
  }
};

const verifyFlutterwavePayment = async (req, res) => {
  let session;
  try {
    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ success: false, message: "Transaction ID is required." });

    const verified = await verifyDeposit(transactionId);
    const transaction = verified.data;
    if (!transaction || String(transaction.status).toLowerCase() !== "successful") {
      return res.status(400).json({ success: false, message: "Payment was not successful." });
    }
    if (!transaction.tx_ref) return res.status(400).json({ success: false, message: "Transaction reference is missing." });

    session = await mongoose.startSession();
    session.startTransaction();

    const payment = await Payment.findOne({ reference: transaction.tx_ref, provider: "FLUTTERWAVE", user: req.user._id }).session(session);
    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Payment record not found." });
    }
    if (payment.status === "SUCCESS") {
      await session.abortTransaction();
      return res.json({ success: true, alreadyProcessed: true, payment, walletCredited: true });
    }

    if (String(transaction.currency).toUpperCase() !== "NGN" || String(payment.currency).toUpperCase() !== "NGN") {
      payment.status = "FAILED";
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).json({ success: false, message: "Currency mismatch." });
    }

    const expected = Number(payment.amount);
    const received = Math.round(Number(transaction.amount));
    if (!Number.isFinite(received) || received !== expected) {
      payment.status = "FAILED";
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).json({ success: false, message: "Amount mismatch." });
    }

    const settlement = await settleSuccessfulPayment({ paymentId: payment._id, transaction, session });
    await session.commitTransaction();
    return res.json({
      success: true,
      alreadyProcessed: settlement.alreadySettled,
      walletCredited: true,
      payment: settlement.payment,
      result: settlement.result,
    });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    console.error("Flutterwave payment verification error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify payment." });
  } finally {
    if (session) await session.endSession();
  }
};

module.exports = { createFlutterwaveDeposit, verifyFlutterwavePayment };
