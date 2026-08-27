const crypto = require("crypto");
const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const { verifyDeposit } = require("../services/flutterwaveProvider");
const { settleSuccessfulPayment } = require("../services/paymentSettlementService");

const verifyFlutterwaveSignature = (req) => {
  const signature = req.headers["verif-hash"];
  const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;

  if (!signature || !secret || !Buffer.isBuffer(req.body)) return false;

  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(String(signature), "utf8");
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
};

const handleFlutterwaveWebhook = async (req, res) => {
  if (!verifyFlutterwaveSignature(req)) {
    console.warn("Rejected Flutterwave webhook: invalid signature.");
    return res.status(401).send("Invalid signature.");
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid webhook payload.");
  }

  // Acknowledge events we do not need to settle. This prevents unnecessary retries.
  if (event?.event !== "charge.completed" || !event?.data) {
    return res.status(200).send("Event received.");
  }

  const data = event.data;
  const reference = data.tx_ref;
  const transactionId = data.id;

  if (!reference || !transactionId) {
    return res.status(400).send("Invalid transaction.");
  }

  let session;
  try {
    // Never trust the webhook amount/status alone. Fetch the transaction from
    // Flutterwave and use the verified response as the source of truth.
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
    }).session(session);

    if (!payment) {
      await session.abortTransaction();
      return res.status(200).send("Event received.");
    }

    if (payment.status === "SUCCESS") {
      await session.abortTransaction();
      return res.status(200).send("Payment already processed.");
    }

    if (String(transaction.status).toLowerCase() !== "successful") {
      payment.status = "FAILED";
      payment.providerTransactionId = String(transaction.id);
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(200).send("Payment was not successful.");
    }

    if (
      String(transaction.currency).toUpperCase() !==
      String(payment.currency).toUpperCase()
    ) {
      payment.status = "FAILED";
      payment.providerTransactionId = String(transaction.id);
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).send("Currency mismatch.");
    }

    // Flutterwave may return decimal major-unit amounts. Compare using the
    // provider currency's smallest-unit precision to avoid floating-point errors.
    const expectedMajor = Number(payment.amount) / 100;
    const receivedMajor = Number(transaction.amount);
    if (!Number.isFinite(receivedMajor) || Math.round(receivedMajor * 100) !== Math.round(expectedMajor * 100)) {
      payment.status = "FAILED";
      payment.providerTransactionId = String(transaction.id);
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).send("Amount mismatch.");
    }

    const settlement = await settleSuccessfulPayment({
      paymentId: payment._id,
      transaction,
      session,
    });

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
