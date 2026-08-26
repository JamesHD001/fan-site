const Membership = require("../models/Membership");
const Booking = require("../models/Booking");
const GiftTransaction = require("../models/GiftTransaction");
const Payment = require("../models/Payment");

const {
  calculateExpiryDate,
  generateMembershipNumber,
} = require("../utils/membership");

/**
 * Settles a verified successful Paystack transaction.
 *
 * This is the single domain mutation point for successful payments. It is
 * deliberately independent of HTTP so webhooks and authenticated callbacks
 * cannot implement different settlement rules.
 */
const settleSuccessfulPayment = async ({
  paymentId,
  transaction,
  session,
}) => {
  if (!paymentId || !transaction || !session) {
    throw new Error("Payment settlement requires paymentId, transaction and session.");
  }

  const payment = await Payment.findById(paymentId).session(session);

  if (!payment) {
    throw new Error("Payment record not found.");
  }

  if (payment.status === "SUCCESS") {
    return {
      payment,
      alreadySettled: true,
      notification: null,
      result: await getSettlementResult(payment, session),
    };
  }

  if (payment.type === "MEMBERSHIP") {
    const membership = await Membership.findById(payment.membership)
      .populate("plan")
      .session(session);

    if (!membership) {
      throw new Error("Membership record not found.");
    }

    if (membership.status !== "ACTIVE") {
      const startDate = new Date();
      membership.status = "ACTIVE";
      membership.startedAt = startDate;
      membership.expiresAt = calculateExpiryDate(startDate, membership.plan);

      if (!membership.membershipNumber) {
        membership.membershipNumber = generateMembershipNumber();
      }

      await membership.save({ session });
    }

    markPaymentSuccessful(payment, transaction);
    await payment.save({ session });

    return {
      payment,
      alreadySettled: false,
      notification: {
        type: "MEMBERSHIP",
        userId: membership.user.toString(),
        membershipNumber: membership.membershipNumber,
      },
      result: { membership },
    };
  }

  if (payment.type === "MEETING") {
    const booking = await Booking.findById(payment.booking)
      .populate("meetingType")
      .session(session);

    if (!booking) {
      throw new Error("Booking record not found.");
    }

    if (booking.status === "PENDING_PAYMENT") {
      booking.status = "CONFIRMED";
      booking.confirmedAt = new Date();
      await booking.save({ session });
    }

    markPaymentSuccessful(payment, transaction);
    await payment.save({ session });

    return {
      payment,
      alreadySettled: false,
      notification: {
        type: "MEETING",
        userId: booking.user.toString(),
        reference: booking.reference,
        scheduledFor: booking.scheduledFor,
      },
      result: { booking },
    };
  }

  if (payment.type === "GIFT") {
    const giftTransaction = await GiftTransaction.findById(payment.giftTransaction)
      .populate("gift")
      .session(session);

    if (!giftTransaction) {
      throw new Error("Gift transaction not found.");
    }

    if (giftTransaction.status === "PENDING_PAYMENT") {
      giftTransaction.status = "COMPLETED";
      await giftTransaction.save({ session });
    }

    markPaymentSuccessful(payment, transaction);
    await payment.save({ session });

    return {
      payment,
      alreadySettled: false,
      notification: {
        type: "GIFT",
        userId: giftTransaction.user.toString(),
        giftName: giftTransaction.gift.name,
        quantity: giftTransaction.quantity,
      },
      result: { transaction: giftTransaction },
    };
  }

  throw new Error(`Unsupported payment type: ${payment.type}`);
};

const markPaymentSuccessful = (payment, transaction) => {
  payment.status = "SUCCESS";
  payment.paidAt = transaction.paid_at
    ? new Date(transaction.paid_at)
    : new Date();
  payment.providerTransactionId = String(transaction.id);
  payment.providerResponse = transaction;
};

const getSettlementResult = async (payment, session) => {
  if (payment.type === "MEMBERSHIP") {
    const membership = await Membership.findById(payment.membership)
      .populate("plan")
      .session(session);
    return { membership };
  }

  if (payment.type === "MEETING") {
    const booking = await Booking.findById(payment.booking)
      .populate("meetingType")
      .session(session);
    return { booking };
  }

  if (payment.type === "GIFT") {
    const transaction = await GiftTransaction.findById(payment.giftTransaction)
      .populate("gift")
      .session(session);
    return { transaction };
  }

  return {};
};

module.exports = {
  settleSuccessfulPayment,
};
