const crypto = require("crypto");

const Payment = require("../models/Payment");
const Membership = require("../models/Membership");
const Booking = require("../models/Booking");
const GiftTransaction = require("../models/GiftTransaction");
const {
  notifyMembershipActivated,
  notifyBookingConfirmed,
  notifyGiftCompleted,
} = require("../services/notificationService");
const { toSubunit } = require("../utils/currency");

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

  if (!secretKey) {
    console.error(
      "PAYSTACK_SECRET_KEY is not configured."
    );

    return false;
  }

  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(req.body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signature)
  );
};

const handlePaystackWebhook = async (req, res) => {
  try {
    if (!verifyPaystackSignature(req)) {
      console.warn(
        "Rejected Paystack webhook: invalid signature."
      );

      return res.status(401).send("Invalid signature.");
    }

    const event = JSON.parse(req.body.toString());

    console.log(
      `Paystack webhook received: ${event.event}`
    );

    /*
     * We acknowledge events we don't currently need.
     */
    if (event.event !== "charge.success") {
      return res.status(200).send("Event received.");
    }

    const transaction = event.data;

    if (!transaction || !transaction.reference) {
      console.warn(
        "Paystack webhook contained no transaction reference."
      );

      return res.status(400).send("Invalid transaction.");
    }

    const payment = await Payment.findOne({
      reference: transaction.reference,
      provider: "PAYSTACK",
    });

    if (!payment) {
      console.warn(
        `Payment not found for reference: ${transaction.reference}`
      );

      /*
       * Return 200 so Paystack doesn't repeatedly retry
       * an event for a payment that doesn't belong to us.
       */
      return res.status(200).send("Event received.");
    }

    /*
     * Idempotency:
     *
     * If this payment has already been processed,
     * do nothing.
     */
    if (payment.status === "SUCCESS") {
      return res.status(200).send("Payment already processed.");
    }

    /*
     * Validate amount.
     *
     * Payment.amount is stored in normal currency units,
     * while Paystack's transaction.amount is in subunits.
     */
    const expectedAmount = toSubunit(
      payment.amount,
      payment.currency
    );

    if (
      Number(transaction.amount) !==
      Number(expectedAmount)
    ) {
      console.error(
        `Webhook amount mismatch for ${payment.reference}`
      );

      payment.status = "FAILED";
      payment.providerResponse = transaction;

      await payment.save();

      return res.status(400).send("Amount mismatch.");
    }

    /*
     * Validate currency.
     */
    if (
      transaction.currency.toUpperCase() !==
      payment.currency.toUpperCase()
    ) {
      console.error(
        `Webhook currency mismatch for ${payment.reference}`
      );

      payment.status = "FAILED";
      payment.providerResponse = transaction;

      await payment.save();

      return res.status(400).send("Currency mismatch.");
    }

    /*
     * Handle successful membership payment.
     */
    if (
      payment.type === "MEMBERSHIP" &&
      payment.membership
    ) {
      const membership = await Membership.findById(
        payment.membership
      ).populate("plan");

      if (!membership) {
        console.error(
          `Membership not found for payment ${payment.reference}`
        );

        return res.status(200).send(
          "Payment received but membership not found."
        );
      }

      if (membership.status !== "ACTIVE") {
        const startDate = new Date();

        membership.status = "ACTIVE";
        membership.startedAt = startDate;
        membership.expiresAt =
          calculateExpiryDate(
            startDate,
            membership.plan
          );

        if (!membership.membershipNumber) {
          membership.membershipNumber =
            generateMembershipNumber();
        }

        await membership.save();
      }

      payment.status = "SUCCESS";
      payment.paidAt =
        transaction.paid_at
          ? new Date(transaction.paid_at)
          : new Date();

      payment.providerTransactionId =
        String(transaction.id);

      payment.providerResponse = transaction;

      await payment.save();

      await notifyMembershipActivated(
        membership.user.toString(),
        membership.membershipNumber
      );

      console.log(
        `Membership activated from webhook: ${membership.membershipNumber}`
      );
    }

    /*
     * Handle successful meeting booking payment.
     */
    if (payment.type === "MEETING") {
      const booking = await Booking.findById(
        payment.booking
      );

      if (!booking) {
        console.error(
          `Booking not found for payment ${payment.reference}`
        );

        return res.status(200).send(
          "Payment received but booking not found."
        );
      }

      if (booking.status === "PENDING_PAYMENT") {
        booking.status = "CONFIRMED";
        booking.confirmedAt = new Date();

        await booking.save();
      }

      payment.status = "SUCCESS";
      payment.paidAt =
        transaction.paid_at
          ? new Date(transaction.paid_at)
          : new Date();

      payment.providerTransactionId =
        String(transaction.id);

      payment.providerResponse = transaction;

      await payment.save();

      await notifyBookingConfirmed(
        booking.user.toString(),
        booking.reference,
        booking.scheduledFor
      );

      console.log(
        `Booking confirmed from webhook: ${booking.reference}`
      );
    }

    /*
     * Handle successful gift payment.
     */
    if (payment.type === "GIFT") {
      const giftTransaction =
        await GiftTransaction.findById(
          payment.giftTransaction
        );

      if (!giftTransaction) {
        console.error(
          `Gift transaction not found for payment ${payment.reference}`
        );

        return res.status(200).send(
          "Payment received but gift transaction not found."
        );
      }

      if (
        giftTransaction.status === "PENDING_PAYMENT"
      ) {
        giftTransaction.status = "COMPLETED";

        await giftTransaction.save();
      }

      payment.status = "SUCCESS";
      payment.paidAt =
        transaction.paid_at
          ? new Date(transaction.paid_at)
          : new Date();

      payment.providerTransactionId =
        String(transaction.id);

      payment.providerResponse = transaction;

      await payment.save();

      const populatedGift =
        await giftTransaction.populate(
          "gift",
          "name"
        );

      await notifyGiftCompleted(
        giftTransaction.user.toString(),
        populatedGift.gift.name,
        giftTransaction.quantity
      );

      console.log(
        `Gift completed from webhook: ${giftTransaction.reference}`
      );
    }

    return res.status(200).send("Webhook processed.");
  } catch (error) {
    console.error(
      "Paystack webhook processing error:",
      error
    );

    return res.status(500).send(
      "Webhook processing failed."
    );
  }
};

module.exports = {
  handlePaystackWebhook,
};