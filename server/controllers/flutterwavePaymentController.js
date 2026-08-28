const crypto = require("crypto");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const { initializeDeposit, verifyDeposit, getUsdToNgnRate } = require("../services/flutterwaveProvider");
const { settleSuccessfulPayment, applyProviderTransactionDetails } = require("../services/paymentSettlementService");

// Deposit bounds, in USD cents. Configurable so limits can change without a deploy.
const MIN_DEPOSIT_USD_CENTS = Number(process.env.MIN_DEPOSIT_USD_CENTS || 100); // $1.00
const MAX_DEPOSIT_USD_CENTS = Number(process.env.MAX_DEPOSIT_USD_CENTS || 10000000); // $100,000.00

const generateReference = () =>
  `DEP-${Date.now()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

const isValidProviderTransactionId = (value) => /^\d{1,20}$/.test(String(value));

const respondReviewRequired = (res, payment, message) =>
  res.status(200).json({
    success: false,
    message,
    requiresReview: true,
    reference: payment.reference,
  });

const createFlutterwaveDeposit = async (req, res) => {
  try {
    // originalAmount is USD cents: the exact platform credit the member buys.
    const originalAmount = Number(req.body.amount);
    if (!Number.isInteger(originalAmount) || originalAmount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive integer in USD minor units." });
    }
    if (originalAmount < MIN_DEPOSIT_USD_CENTS || originalAmount > MAX_DEPOSIT_USD_CENTS) {
      return res.status(400).json({
        success: false,
        message: `Deposit must be between ${(MIN_DEPOSIT_USD_CENTS / 100).toFixed(2)} and ${(MAX_DEPOSIT_USD_CENTS / 100).toFixed(2)} USD.`,
      });
    }

    // Use Flutterwave's supported USD/NGN reference rate. The exact snapshot
    // used here is locked to this payment and is never recalculated at verify time.
    const rateSnapshot = await getUsdToNgnRate();
    const exchangeRate = rateSnapshot.rate;
    const providerAmountMajor = Math.ceil((originalAmount / 100) * exchangeRate);
    // Payment.amount is stored in provider minor units (NGN kobo), matching the
    // Payment model contract. Flutterwave checkout receives the corresponding
    // major-unit amount.
    const providerAmountMinor = providerAmountMajor * 100;
    const reference = generateReference();

    const payment = await Payment.create({
      user: req.user._id,
      reference,
      type: "DEPOSIT",
      originalAmount,
      originalCurrency: "USD",
      amount: providerAmountMinor,
      currency: "NGN",
      exchangeRate,
      provider: "FLUTTERWAVE",
      status: "PENDING",
      metadata: {
        purpose: "PLATFORM_CREDIT_DEPOSIT",
        feePolicy: "MERCHANT_ABSORBS_PROVIDER_FEES",
        rateSource: "FLUTTERWAVE_TRANSFER_RATES",
        rateFetchedAt: rateSnapshot.fetchedAt.toISOString(),
        rateWasStale: Boolean(rateSnapshot.stale),
      },
    });

    try {
      const checkout = initializeDeposit({
        amountMajor: providerAmountMajor,
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
        checkout,
        exchangeRate,
        providerAmount: providerAmountMajor,
        providerAmountMinor,
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
    if (!transactionId || !isValidProviderTransactionId(transactionId)) {
      return res.status(400).json({ success: false, message: "A valid transaction ID is required." });
    }

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

    applyProviderTransactionDetails(payment, transaction);
    payment.providerResponse = transaction;

    if (String(transaction.currency).toUpperCase() !== String(payment.currency).toUpperCase()) {
      payment.status = "REQUIRES_REVIEW";
      payment.metadata = { ...payment.metadata, reviewReason: "CURRENCY_MISMATCH", expectedCurrency: payment.currency, receivedCurrency: transaction.currency };
      await payment.save({ session });
      await session.commitTransaction();
      return respondReviewRequired(res, payment, "Payment currency mismatch. This payment has been flagged for review.");
    }

    // Compare provider amount in the same units: Flutterwave returns NGN major
    // units while Payment.amount is stored in NGN minor units (kobo).
    const expectedProviderAmountMinor = Number(payment.amount);
    const receivedProviderAmountMinor = Math.round(Number(transaction.amount) * 100);
    if (!Number.isFinite(receivedProviderAmountMinor) || receivedProviderAmountMinor !== expectedProviderAmountMinor) {
      payment.status = "REQUIRES_REVIEW";
      payment.metadata = { ...payment.metadata, reviewReason: "AMOUNT_MISMATCH", expectedProviderAmountMinor, receivedProviderAmountMinor };
      await payment.save({ session });
      await session.commitTransaction();
      return respondReviewRequired(res, payment, "Payment amount mismatch. This payment has been flagged for review.");
    }

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
