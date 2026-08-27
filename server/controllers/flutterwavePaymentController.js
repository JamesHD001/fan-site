const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const { initializePayment, verifyDeposit } = require("../services/flutterwaveProvider");

const createFlutterwaveDeposit = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive integer in USD minor units." });
    }

    const reference = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const payment = await Payment.create({
      user: req.user._id,
      reference,
      type: "DEPOSIT",
      amount: amount,
      originalAmount: amount,
      currency: "USD",
      provider: "FLUTTERWAVE",
      status: "PENDING",
      description: "Platform wallet funding",
    });

    try {
      const result = await initializePayment({
        amount: amount / 100,
        currency: "USD",
        reference,
        email: req.user.email,
        name: req.user.name || `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
        redirectUrl: `${process.env.CLIENT_URL}/payment/flutterwave-callback`,
        metadata: { paymentId: payment._id.toString(), userId: req.user._id.toString(), type: "DEPOSIT" },
      });

      return res.status(201).json({ success: true, paymentId: payment._id, reference, authorizationUrl: result.data.link });
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
      return res.json({ success: true, alreadyProcessed: true, payment });
    }

    if (String(transaction.currency).toUpperCase() !== String(payment.currency).toUpperCase()) {
      payment.status = "FAILED";
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).json({ success: false, message: "Currency mismatch." });
    }

    const expected = Math.round(Number(payment.amount));
    const received = Math.round(Number(transaction.amount) * 100);
    if (!Number.isFinite(received) || received !== expected) {
      payment.status = "FAILED";
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).json({ success: false, message: "Amount mismatch." });
    }

    const { settleSuccessfulPayment } = require("../services/paymentSettlementService");
    const settlement = await settleSuccessfulPayment({ paymentId: payment._id, transaction, session });
    await session.commitTransaction();

    return res.json({ success: true, alreadyProcessed: settlement.alreadySettled, payment: settlement.payment, result: settlement.result });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    console.error("Flutterwave payment verification error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify payment." });
  } finally {
    if (session) await session.endSession();
  }
};

module.exports = { createFlutterwaveDeposit, verifyFlutterwavePayment };
