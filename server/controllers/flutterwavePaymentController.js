const crypto = require("crypto");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const PaymentMethod = require("../models/PaymentMethod");
const { initializeDeposit, verifyDeposit, getUsdToNgnRate } = require("../services/flutterwaveProvider");
const { chargeSavedCard, extractCardToken, extractCardMetadata } = require("../services/flutterwaveTokenService");
const { settleSuccessfulPayment, applyProviderTransactionDetails } = require("../services/paymentSettlementService");

const MIN_DEPOSIT_USD_CENTS = Number(process.env.MIN_DEPOSIT_USD_CENTS || 100);
const MAX_DEPOSIT_USD_CENTS = Number(process.env.MAX_DEPOSIT_USD_CENTS || 10000000);
const generateReference = () => `DEP-${Date.now()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
const isValidProviderTransactionId = (value) => /^\d{1,20}$/.test(String(value));

const validateOriginalAmount = (value) => {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Amount must be a positive integer in USD minor units.");
  if (amount < MIN_DEPOSIT_USD_CENTS || amount > MAX_DEPOSIT_USD_CENTS) {
    throw new Error(`Deposit must be between ${(MIN_DEPOSIT_USD_CENTS / 100).toFixed(2)} and ${(MAX_DEPOSIT_USD_CENTS / 100).toFixed(2)} USD.`);
  }
  return amount;
};

const respondReviewRequired = (res, payment, message) => res.status(200).json({ success: false, message, requiresReview: true, reference: payment.reference });

const createFlutterwaveDeposit = async (req, res) => {
  try {
    const originalAmount = validateOriginalAmount(req.body.amount);
    const rateSnapshot = await getUsdToNgnRate();
    const exchangeRate = rateSnapshot.rate;
    const providerAmountMajor = Math.ceil((originalAmount / 100) * exchangeRate);
    const providerAmountMinor = providerAmountMajor * 100;
    const reference = generateReference();

    const payment = await Payment.create({
      user: req.user._id, reference, type: "DEPOSIT", originalAmount, originalCurrency: "USD",
      amount: providerAmountMinor, currency: "NGN", exchangeRate, provider: "FLUTTERWAVE", status: "PENDING",
      metadata: {
        purpose: "PLATFORM_CREDIT_DEPOSIT", feePolicy: "MERCHANT_ABSORBS_PROVIDER_FEES",
        rateSource: "FLUTTERWAVE_TRANSFER_RATES", rateFetchedAt: rateSnapshot.fetchedAt.toISOString(), rateWasStale: Boolean(rateSnapshot.stale),
      },
    });

    try {
      const checkout = initializeDeposit({
        amountMajor: providerAmountMajor, currency: "NGN", reference, email: req.user.email,
        name: req.user.name || `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
        metadata: { paymentId: payment._id.toString(), userId: req.user._id.toString(), type: "DEPOSIT" },
      });
      payment.providerResponse = checkout;
      await payment.save();
      return res.status(201).json({ success: true, paymentId: payment._id, reference, checkout, exchangeRate, providerAmount: providerAmountMajor, providerAmountMinor });
    } catch (error) {
      payment.status = "FAILED";
      payment.providerResponse = { message: error.message };
      await payment.save();
      throw error;
    }
  } catch (error) {
    console.error("Flutterwave deposit initialization error:", error);
    return res.status(500).json({ success: false, message: error.message === "Amount must be a positive integer in USD minor units." || error.message.startsWith("Deposit must be") ? error.message : "Unable to initialize wallet funding." });
  }
};

const saveCardFromTransaction = async ({ userId, transaction }) => {
  const token = extractCardToken(transaction);
  if (!token) return null;
  const metadata = extractCardMetadata(transaction);
  const existing = await PaymentMethod.findOne({ user: userId, provider: "FLUTTERWAVE", token });
  if (existing) return existing;
  const hasDefault = await PaymentMethod.exists({ user: userId, status: "ACTIVE", isDefault: true });
  return PaymentMethod.create({
    user: userId, provider: "FLUTTERWAVE", type: "CARD", token,
    email: transaction.customer_email || transaction.customer?.email,
    ...metadata, isDefault: !hasDefault, metadata: { source: "INITIAL_PAYMENT" },
  });
};

const verifyFlutterwavePayment = async (req, res) => {
  let session;
  try {
    const { transactionId } = req.body;
    if (!transactionId || !isValidProviderTransactionId(transactionId)) return res.status(400).json({ success: false, message: "A valid transaction ID is required." });
    const verified = await verifyDeposit(transactionId);
    const transaction = verified.data;
    if (!transaction || String(transaction.status).toLowerCase() !== "successful") return res.status(400).json({ success: false, message: "Payment was not successful." });
    if (!transaction.tx_ref) return res.status(400).json({ success: false, message: "Transaction reference is missing." });

    session = await mongoose.startSession();
    session.startTransaction();
    const payment = await Payment.findOne({ reference: transaction.tx_ref, provider: "FLUTTERWAVE", user: req.user._id }).session(session);
    if (!payment) { await session.abortTransaction(); return res.status(404).json({ success: false, message: "Payment record not found." }); }
    if (payment.status === "SUCCESS") { await session.abortTransaction(); return res.json({ success: true, alreadyProcessed: true, walletCredited: true }); }

    applyProviderTransactionDetails(payment, transaction);
    payment.providerResponse = transaction;

    if (String(transaction.currency).toUpperCase() !== String(payment.currency).toUpperCase()) {
      payment.status = "REQUIRES_REVIEW";
      payment.metadata = { ...payment.metadata, reviewReason: "CURRENCY_MISMATCH", expectedCurrency: payment.currency, receivedCurrency: transaction.currency };
      await payment.save({ session }); await session.commitTransaction();
      return respondReviewRequired(res, payment, "Payment currency mismatch. This payment has been flagged for review.");
    }

    const expectedProviderAmountMinor = Number(payment.amount);
    const receivedProviderAmountMinor = Math.round(Number(transaction.amount) * 100);
    if (!Number.isFinite(receivedProviderAmountMinor) || receivedProviderAmountMinor !== expectedProviderAmountMinor) {
      payment.status = "REQUIRES_REVIEW";
      payment.metadata = { ...payment.metadata, reviewReason: "AMOUNT_MISMATCH", expectedProviderAmountMinor, receivedProviderAmountMinor };
      await payment.save({ session }); await session.commitTransaction();
      return respondReviewRequired(res, payment, "Payment amount mismatch. This payment has been flagged for review.");
    }

    const settlement = await settleSuccessfulPayment({ paymentId: payment._id, transaction, session });
    await session.commitTransaction();
    let savedCard = null;
    if (payment.metadata?.saveCard) {
      try { savedCard = await saveCardFromTransaction({ userId: req.user._id, transaction }); }
      catch (error) { console.error("Unable to save Flutterwave card token:", error); }
    }
    return res.json({ success: true, alreadyProcessed: settlement.alreadySettled, walletCredited: true, payment: settlement.payment, paymentMethodSaved: Boolean(savedCard) });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    console.error("Flutterwave payment verification error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify payment." });
  } finally { if (session) await session.endSession(); }
};

const createSavedCardDeposit = async (req, res) => {
  let payment;
  try {
    const originalAmount = validateOriginalAmount(req.body.amount);
    const paymentMethod = await PaymentMethod.findOne({ _id: req.body.paymentMethodId, user: req.user._id, status: "ACTIVE" }).select("+token");
    if (!paymentMethod) return res.status(404).json({ success: false, message: "Payment method not found." });
    if (paymentMethod.email !== req.user.email.toLowerCase()) return res.status(409).json({ success: false, message: "This saved card must be re-authorized because the account email changed." });

    const rateSnapshot = await getUsdToNgnRate();
    const providerAmountMajor = Math.ceil((originalAmount / 100) * rateSnapshot.rate);
    payment = await Payment.create({
      user: req.user._id, reference: generateReference(), type: "DEPOSIT", originalAmount, originalCurrency: "USD",
      amount: providerAmountMajor * 100, currency: "NGN", exchangeRate: rateSnapshot.rate, provider: "FLUTTERWAVE", status: "PENDING",
      metadata: { purpose: "PLATFORM_CREDIT_DEPOSIT", paymentMethodId: paymentMethod._id.toString(), rateSource: "FLUTTERWAVE_TRANSFER_RATES", rateFetchedAt: rateSnapshot.fetchedAt.toISOString(), rateWasStale: Boolean(rateSnapshot.stale), silentPreferred: true },
    });

    const charge = await chargeSavedCard({ token: paymentMethod.token, email: paymentMethod.email, amountMajor: providerAmountMajor, reference: payment.reference, narration: "Wallet funding" });
    payment.providerResponse = charge;
    await payment.save();

    const providerTransactionId = charge.data?.id || charge.data?.transaction_id;
    const providerStatus = String(charge.data?.status || charge.status || "").toLowerCase();
    if (providerStatus === "successful" && providerTransactionId) {
      // Re-use the exact verification and settlement path rather than trusting the charge response alone.
      const verified = await verifyDeposit(providerTransactionId);
      const transaction = verified.data;
      if (String(transaction?.status).toLowerCase() === "successful") {
        await settleSavedCardPayment(req.user._id, payment, transaction);
        return res.status(201).json({ success: true, status: "SUCCESS", walletCredited: true, message: "Transaction successful. Your balance has been updated." });
      }
    }

    const authorizationUrl = charge.data?.link || charge.data?.redirect_url || null;
    return res.status(202).json({ success: false, pending: true, authorizationRequired: Boolean(authorizationUrl), authorizationUrl, reference: payment.reference, message: authorizationUrl ? "Your bank requires payment authorization." : "Payment is being processed. Your balance will update after verification." });
  } catch (error) {
    if (payment) { payment.status = "FAILED"; payment.providerResponse = { message: error.message }; await payment.save().catch(() => {}); }
    console.error("Flutterwave saved-card deposit error:", error);
    return res.status(500).json({ success: false, message: "Unable to process wallet funding with the saved card." });
  }
};

const settleSavedCardPayment = async (userId, payment, transaction) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const current = await Payment.findOne({ _id: payment._id, user: userId }).session(session);
    if (!current) throw new Error("Payment record not found.");
    applyProviderTransactionDetails(current, transaction);
    if (String(transaction.currency).toUpperCase() !== current.currency || Math.round(Number(transaction.amount) * 100) !== Number(current.amount)) {
      current.status = "REQUIRES_REVIEW";
      current.metadata = { ...current.metadata, reviewReason: "PROVIDER_AMOUNT_OR_CURRENCY_MISMATCH" };
      await current.save({ session }); await session.commitTransaction(); return;
    }
    await settleSuccessfulPayment({ paymentId: current._id, transaction, session });
    await session.commitTransaction();
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally { await session.endSession(); }
};

module.exports = { createFlutterwaveDeposit, verifyFlutterwavePayment, createSavedCardDeposit };
