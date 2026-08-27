const crypto = require("crypto");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const User = require("../models/User");
const { convertUsdToNgn } = require("../services/paymentService");
const { initializeDeposit, verifyDeposit } = require("../services/flutterwaveProvider");
const { settleSuccessfulPayment } = require("../services/paymentSettlementService");

const createDeposit = async (req, res) => {
  try {
    const amountUsd = Number(req.body.amount);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0 || Math.round(amountUsd * 100) !== amountUsd * 100) {
      return res.status(400).json({ success: false, message: "Amount must be a positive USD amount with at most two decimal places." });
    }
    const originalAmount = Math.round(amountUsd * 100);
    const conversion = await convertUsdToNgn(originalAmount);
    const redirectUrl = process.env.FLUTTERWAVE_REDIRECT_URL;
    if (!redirectUrl) return res.status(500).json({ success: false, message: "FLUTTERWAVE_REDIRECT_URL is not configured." });
    const user = await User.findById(req.user._id).select("name email");
    if (!user) return res.status(404).json({ success: false, message: "User account not found." });

    const reference = `DEP-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const payment = await Payment.create({ user: user._id, type: "DEPOSIT", reference, originalAmount, originalCurrency: "USD", amount: conversion.ngnAmountMinor, currency: "NGN", exchangeRate: conversion.exchangeRate, provider: "FLUTTERWAVE", status: "PENDING" });

    try {
      const initialized = await initializeDeposit({ reference, email: user.email, name: user.name, amountMajor: conversion.ngnAmountMinor / 100, currency: "NGN", redirectUrl, metadata: { paymentId: payment._id.toString(), userId: user._id.toString(), originalAmount, originalCurrency: "USD" } });
      payment.providerResponse = initialized;
      await payment.save();
      return res.status(201).json({ success: true, reference, paymentId: payment._id, amount: amountUsd, currency: "USD", chargeAmount: conversion.ngnAmountMinor / 100, chargeCurrency: "NGN", exchangeRate: conversion.exchangeRate, checkoutUrl: initialized?.data?.link });
    } catch (error) {
      payment.status = "FAILED";
      payment.providerResponse = { message: error.message };
      await payment.save();
      throw error;
    }
  } catch (error) {
    console.error("Flutterwave deposit initialization error:", error);
    return res.status(500).json({ success: false, message: error.message || "Unable to initialize Flutterwave deposit." });
  }
};

const verifyFlutterwaveDeposit = async (req, res) => {
  let session;
  try {
    const { reference, transactionId } = req.body;
    if (!reference || !transactionId) return res.status(400).json({ success: false, message: "Reference and transaction ID are required." });
    const payment = await Payment.findOne({ reference, user: req.user._id, provider: "FLUTTERWAVE", type: "DEPOSIT" });
    if (!payment) return res.status(404).json({ success: false, message: "Flutterwave deposit not found for this account." });
    if (payment.status === "SUCCESS") return res.status(200).json({ success: true, message: "Deposit has already been verified.", payment });

    const result = await verifyDeposit(transactionId);
    const transaction = result.data;
    const receivedAmount = Number(transaction.amount);
    if (transaction.tx_ref !== payment.reference) return res.status(400).json({ success: false, message: "Payment reference mismatch." });
    if (transaction.currency?.toUpperCase() !== payment.currency.toUpperCase()) return res.status(400).json({ success: false, message: "Payment currency mismatch." });
    if (!Number.isFinite(receivedAmount) || Math.round(receivedAmount * 100) !== payment.amount) return res.status(400).json({ success: false, message: "Payment amount mismatch." });
    if (transaction.status !== "successful") {
      payment.status = transaction.status === "pending" ? "PROCESSING" : "FAILED";
      payment.providerTransactionId = String(transaction.id || transactionId);
      payment.providerResponse = transaction;
      await payment.save();
      return res.status(400).json({ success: false, message: "Payment was not successful.", status: transaction.status });
    }

    session = await mongoose.startSession();
    session.startTransaction();
    const settlement = await settleSuccessfulPayment({ paymentId: payment._id, transaction, session });
    await session.commitTransaction();
    return res.status(200).json({ success: true, message: "Flutterwave deposit verified and credited successfully.", payment: settlement.payment, ...settlement.result });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    console.error("Flutterwave deposit verification error:", error);
    return res.status(500).json({ success: false, message: error.message || "Unable to verify Flutterwave deposit." });
  } finally {
    if (session) await session.endSession();
  }
};

module.exports = { createDeposit, verifyFlutterwaveDeposit };
