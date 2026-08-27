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
    // originalAmount is USD cents: the exact platform credit the member buys.
    const originalAmount = Number(req.body.amount);
    if (!Number.isInteger(originalAmount) || originalAmount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive integer in USD minor units." });
    }

    const exchangeRate = getNgnPerUsdRate();
    // Lock the provider charge at initialization. Do not recalculate it during verification.
    const providerAmount = Math.ceil((originalAmount / 100) * exchangeRate);
    const reference = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const payment = await Payment.create({
      user: req.user._id,
      reference,
      type: "DEPOSIT",
      originalAmount,
      originalCurrency: "USD",
      amount: providerAmount,
      currency: "NGN",
      exchangeRate,
      provider: "FLUTTERWAVE",
      status: "PENDING",
      metadata: { purpose: "PLATFORM_CREDIT_DEPOSIT", feePolicy: "MERCHANT_ABSORBS_PROVIDER_FEES" },
    });

    try {
      const checkout = initializeDeposit({
        amountMajor: providerAmount,
        currency: "NGN",
        reference,
        email: req.user.email,
        name: req.user.name || `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
        metadata: { paymentId: payment._id.toString(), userId: req.user._id.toString(), type: "DEPOSIT" },
      });
      payment.providerResponse = checkout;
      await payment.save();
      return res.status(201).json({ success: true, paymentId: payment._id, reference, checkout });
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
      return res.json({ success: true, alreadyProcessed: true, walletCredited: true });
    }

    if (String(transaction.currency).toUpperCase() !== String(payment.currency).toUpperCase()) {
      payment.status = "FAILED";
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).json({ success: false, message: "Payment currency mismatch." });
    }

    // Compare provider-to-provider. Provider fees/taxes are settlement deductions,
    // not deductions from the amount the customer successfully paid.
    const expectedProviderAmount = Number(payment.amount);
    const receivedProviderAmount = Math.round(Number(transaction.amount));
    if (!Number.isFinite(receivedProviderAmount) || receivedProviderAmount !== expectedProviderAmount) {
      payment.status = "FAILED";
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).json({ success: false, message: "Payment amount mismatch." });
    }

    // Preserve fee/tax fields when the provider exposes them; these do not affect wallet credit.
    if (transaction.fee !== undefined) payment.providerFee = Number(transaction.fee);
    if (transaction.tax !== undefined) payment.providerTax = Number(transaction.tax);
    if (transaction.amount_settled !== undefined) payment.providerNetSettlement = Number(transaction.amount_settled);

    const settlement = await settleSuccessfulPayment({ paymentId: payment._id, transaction, session });
    await session.commitTransaction();
    return res.json({ success: true, alreadyProcessed: settlement.alreadySettled, walletCredited: true, payment: settlement.payment });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    console.error("Flutterwave payment verification error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify payment." });
  } finally {
    if (session) await session.endSession();
  }
};

module.exports = { createFlutterwaveDeposit, verifyFlutterwavePayment };
