const crypto = require("crypto");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const { verifyDeposit } = require("../services/flutterwaveProvider");
const { settleSuccessfulPayment } = require("../services/paymentSettlementService");

const verifyFlutterwaveSignature = (req) => {
  const signature = String(req.headers["verif-hash"] || "");
  const secret = String(process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || "");
  if (!signature || !secret) return false;
  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(signature, "utf8");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

const handleFlutterwaveWebhook = async (req, res) => {
  if (!verifyFlutterwaveSignature(req)) return res.status(401).send("Invalid signature.");

  const event = req.body;
  if (!event || event.event !== "charge.completed" || !event.data) return res.status(200).send("Event received.");

  const { id: transactionId, tx_ref: reference } = event.data;
  if (!reference || !transactionId) return res.status(400).send("Invalid transaction.");

  let session;
  try {
    const verifiedResponse = await verifyDeposit(transactionId);
    const transaction = verifiedResponse.data;
    if (!transaction || transaction.tx_ref !== reference) return res.status(400).send("Transaction reference mismatch.");

    session = await mongoose.startSession();
    session.startTransaction();

    const payment = await Payment.findOne({ reference, provider: "FLUTTERWAVE", type: "DEPOSIT" }).session(session);
    if (!payment) {
      await session.abortTransaction();
      return res.status(200).send("Event received.");
    }
    if (payment.status === "SUCCESS") {
      await session.abortTransaction();
      return res.status(200).send("Payment already processed.");
    }

    payment.providerTransactionId = String(transaction.id);
    payment.providerResponse = transaction;

    if (String(transaction.status).toLowerCase() !== "successful") {
      payment.status = "PROCESSING";
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(200).send("Payment is not yet successful.");
    }

    if (String(transaction.currency).toUpperCase() !== String(payment.currency).toUpperCase()) {
      payment.status = "FAILED";
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).send("Currency mismatch.");
    }

    const expected = Number(payment.amount);
    const received = Math.round(Number(transaction.amount) * 100);
    if (!Number.isFinite(received) || received !== expected) {
      payment.status = "FAILED";
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).send("Amount mismatch.");
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
