const crypto = require("crypto");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const { verifyDeposit } = require("../services/flutterwaveProvider");
const { settleSuccessfulPayment, applyProviderTransactionDetails } = require("../services/paymentSettlementService");

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left), "utf8");
  const b = Buffer.from(String(right), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const verifyFlutterwaveSignature = (req) => {
  const secret = String(process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || "");
  if (!secret) return false;

  // Current Flutterwave webhook signing: HMAC-SHA256(raw request body, secret), Base64 encoded.
  const signature = String(req.headers["flutterwave-signature"] || "");
  if (signature) {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(String(req.rawBody || ""), "utf8");
    if (!rawBody.length) return false;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    return safeEqual(expected, signature);
  }

  // Backward compatibility for older V3/Rave webhook configurations that send verif-hash.
  const legacySignature = String(req.headers["verif-hash"] || "");
  return Boolean(legacySignature) && safeEqual(secret, legacySignature);
};

const handleFlutterwaveWebhook = async (req, res) => {
  if (!verifyFlutterwaveSignature(req)) {
    return res.status(401).send("Invalid signature.");
  }

  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "{}"));
  } catch {
    return res.status(400).send("Invalid JSON payload.");
  }

  // Current Flutterwave payloads use `type`; older payloads may use `event`.
  const eventType = event?.type || event?.event;
  if (!event?.data || (eventType && eventType !== "charge.completed")) {
    return res.status(200).send("Event received.");
  }

  const { id: transactionId, tx_ref: reference } = event.data;
  if (!reference || !transactionId) return res.status(400).send("Invalid transaction.");

  let session;
  try {
    // Never trust the webhook amount/status as the source of truth. Re-query Flutterwave.
    const verifiedResponse = await verifyDeposit(transactionId);
    const transaction = verifiedResponse.data;

    if (!transaction || transaction.tx_ref !== reference) {
      return res.status(400).send("Transaction reference mismatch.");
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const payment = await Payment.findOne({
      reference,
      provider: "FLUTTERWAVE",
      type: "DEPOSIT",
    }).session(session);

    if (!payment) {
      await session.abortTransaction();
      return res.status(200).send("Event received.");
    }

    if (payment.status === "SUCCESS") {
      await session.abortTransaction();
      return res.status(200).send("Payment already processed.");
    }

    payment.providerResponse = transaction;
    applyProviderTransactionDetails(payment, transaction);

    if (String(transaction.status).toLowerCase() !== "successful") {
      payment.status = "PROCESSING";
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(200).send("Payment is not yet successful.");
    }

    if (String(transaction.currency).toUpperCase() !== String(payment.currency).toUpperCase()) {
      // Customer really paid — flag for manual reconciliation, never auto-FAILED.
      payment.status = "REQUIRES_REVIEW";
      payment.metadata = { ...payment.metadata, reviewReason: "CURRENCY_MISMATCH", expectedCurrency: payment.currency, receivedCurrency: transaction.currency };
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(409).send("Currency mismatch. Flagged for review.");
    }

    // Flutterwave amount is expressed in the transaction currency's major unit.
    // Our Payment.amount is also stored as NGN major-unit amount for this flow.
    const expected = Number(payment.amount);
    const received = Number(transaction.amount);
    if (!Number.isFinite(received) || received !== expected) {
      payment.status = "REQUIRES_REVIEW";
      payment.metadata = { ...payment.metadata, reviewReason: "AMOUNT_MISMATCH", expectedProviderAmount: expected, receivedProviderAmount: received };
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(409).send("Amount mismatch. Flagged for review.");
    }

    await settleSuccessfulPayment({ paymentId: payment._id, transaction, session });
    await session.commitTransaction();
    return res.status(200).send("Webhook processed.");
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    console.error("Flutterwave webhook processing error:", error);
    return res.status(500).send("Webhook processing failed.");
  } finally {
    if (session) await session.endSession();
  }
};

module.exports = { handleFlutterwaveWebhook };
