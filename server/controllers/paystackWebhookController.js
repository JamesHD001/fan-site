const crypto = require("crypto");
const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const Membership = require("../models/Membership");
const Booking = require("../models/Booking");
const GiftTransaction = require("../models/GiftTransaction");
const {
  notifyMembershipActivated,
  notifyBookingConfirmed,
  notifyGiftCompleted,
} = require("../services/notificationService");

const {
  calculateExpiryDate,
  generateMembershipNumber,
} = require("../utils/membership");

const verifyPaystackSignature = (req) => {
  const signature = req.headers["x-paystack-signature"];

  if (!signature) {
    return false;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey || !Buffer.isBuffer(req.body)) {
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

    if (!transaction || !transaction.reference) {
      console.warn("Paystack webhook contained no transaction reference.");
      return res.status(400).send("Invalid transaction.");
    }

    session = await mongoose.startSession();
    session.startTransaction();

    // Claim the payment inside the transaction. Concurrent webhook deliveries
    // cannot both process a payment that has already reached SUCCESS.
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

    let notification = null;

    if (payment.type === "MEMBERSHIP" && payment.membership) {
      const membership = await Membership.findById(payment.membership)
        .populate("plan")
        .session(session);

      if (!membership) {
        await session.abortTransaction();
        return res.status(200).send(
          "Payment received but membership not found."
        );
      }

      if (membership.status !== "ACTIVE") {
        const startDate = new Date();

        membership.status = "ACTIVE";
        membership.startedAt = startDate;
        membership.expiresAt = calculateExpiryDate(
          startDate,
          membership.plan
        );

        if (!membership.membershipNumber) {
          membership.membershipNumber = generateMembershipNumber();
        }

        await membership.save({ session });
      }

      payment.status = "SUCCESS";
      payment.paidAt = transaction.paid_at
        ? new Date(transaction.paid_at)
        : new Date();
      payment.providerTransactionId = String(transaction.id);
      payment.providerResponse = transaction;
      await payment.save({ session });

      notification = {
        type: "MEMBERSHIP",
        userId: membership.user.toString(),
        membershipNumber: membership.membershipNumber,
      };
    } else if (payment.type === "MEETING") {
      const booking = await Booking.findById(payment.booking).session(session);

      if (!booking) {
        await session.abortTransaction();
        return res.status(200).send("Payment received but booking not found.");
      }

      if (booking.status === "PENDING_PAYMENT") {
        booking.status = "CONFIRMED";
        booking.confirmedAt = new Date();
        await booking.save({ session });
      }

      payment.status = "SUCCESS";
      payment.paidAt = transaction.paid_at
        ? new Date(transaction.paid_at)
        : new Date();
      payment.providerTransactionId = String(transaction.id);
      payment.providerResponse = transaction;
      await payment.save({ session });

      notification = {
        type: "MEETING",
        userId: booking.user.toString(),
        reference: booking.reference,
        scheduledFor: booking.scheduledFor,
      };
    } else if (payment.type === "GIFT") {
      const giftTransaction = await GiftTransaction.findById(
        payment.giftTransaction
      ).session(session);

      if (!giftTransaction) {
        await session.abortTransaction();
        return res.status(200).send(
          "Payment received but gift transaction not found."
        );
      }

      if (giftTransaction.status === "PENDING_PAYMENT") {
        giftTransaction.status = "COMPLETED";
        await giftTransaction.save({ session });
      }

      payment.status = "SUCCESS";
      payment.paidAt = transaction.paid_at
        ? new Date(transaction.paid_at)
        : new Date();
      payment.providerTransactionId = String(transaction.id);
      payment.providerResponse = transaction;
      await payment.save({ session });

      const populatedGift = await giftTransaction.populate("gift", "name");

      notification = {
        type: "GIFT",
        userId: giftTransaction.user.toString(),
        giftName: populatedGift.gift.name,
        quantity: giftTransaction.quantity,
      };
    } else {
      await session.abortTransaction();
      return res.status(400).send("Unsupported payment type.");
    }

    await session.commitTransaction();

    // Notifications are intentionally sent after the database transaction
    // commits, so a notification failure cannot roll back a successful payment.
    if (notification?.type === "MEMBERSHIP") {
      await notifyMembershipActivated(
        notification.userId,
        notification.membershipNumber
      );
    }

    if (notification?.type === "MEETING") {
      await notifyBookingConfirmed(
        notification.userId,
        notification.reference,
        notification.scheduledFor
      );
    }

    if (notification?.type === "GIFT") {
      await notifyGiftCompleted(
        notification.userId,
        notification.giftName,
        notification.quantity
      );
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
