const crypto = require("crypto");
const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const { settleSuccessfulPayment } = require("../services/paymentSettlementService");
const {
  notifyMembershipActivated,
  notifyBookingConfirmed,
  notifyGiftCompleted,
} = require("../services/notificationService");

const verifyPaystackSignature = (req) => {
  const signature = req.headers["x-paystack-signature"];
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!signature || !secretKey || !Buffer.isBuffer(req.body)) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha512", secretKey)
    .update(req.body)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const sendSettlementNotification = async (notification) => {
  if (!notification) return;

  if (notification.type === "MEMBERSHIP") {
    await notifyMembershipActivated(
      notification.userId,
      notification.membershipNumber
    );
  }

  if (notification.type === "MEETING") {
    await notifyBookingConfirmed(
      notification.userId,
      notification.reference,
      notification.scheduledFor
    );
  }

  if (notification.type === "GIFT") {
    await notifyGiftCompleted(
      notification.userId,
      notification.giftName,
      notification.quantity
    );
  }
};

const handlePaystackWebhook = async (req, res) => {
  let session;

  try {
    if (!verifyPaystackSignature(req)) {
      console.warn("Rejected Paystack webhook: invalid signature.");
      return res.status(401).send("Invalid signature.");
    }

    const event = JSON.parse(req.body.toString("utf8"));

    console.log(`Paystack webhook received: ${event.event}`);

    if (event.event !== "charge.success") {
      return res.status(200).send("Event received.");
    }

    const transaction = event.data;

    if (!transaction?.reference) {
      return res.status(400).send("Invalid transaction.");
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const payment = await Payment.findOne({
      reference: transaction.reference,
      provider: "PAYSTACK",
    }).session(session);

    if (!payment) {
      await session.abortTransaction();
      return res.status(200).send("Event received.");
    }

    if (payment.status === "SUCCESS") {
      await session.abortTransaction();
      return res.status(200).send("Payment already processed.");
    }

    if (Number(transaction.amount) !== Number(payment.amount)) {
      payment.status = "FAILED";
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).send("Amount mismatch.");
    }

    if (
      !transaction.currency ||
      transaction.currency.toUpperCase() !== payment.currency.toUpperCase()
    ) {
      payment.status = "FAILED";
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).send("Currency mismatch.");
    }

    if (transaction.status !== "success") {
      payment.status =
        transaction.status === "abandoned" ? "ABANDONED" : "FAILED";
      payment.providerResponse = transaction;
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(200).send("Payment was not successful.");
    }

    const settlement = await settleSuccessfulPayment({
      paymentId: payment._id,
      transaction,
      session,
    });

    await session.commitTransaction();

    if (!settlement.alreadySettled) {
      await sendSettlementNotification(settlement.notification);
    }

    return res.status(200).send("Webhook processed.");
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Paystack webhook processing error:", error);
    return res.status(500).send("Webhook processing failed.");
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

module.exports = {
  handlePaystackWebhook,
};
