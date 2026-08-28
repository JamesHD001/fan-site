const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Membership = require("../models/Membership");
const Booking = require("../models/Booking");
const GiftTransaction = require("../models/GiftTransaction");
const { calculateExpiryDate, generateMembershipNumber } = require("../utils/membership");
const {
  notifyMembershipActivated,
  notifyBookingConfirmed,
  notifyGiftCompleted,
} = require("./notificationService");

const buildSettlementNotification = async (payment, session) => {
  if (payment.type === "MEMBERSHIP") {
    const membership = await Membership.findById(payment.membership)
      .populate("plan")
      .session(session);
    if (!membership) throw new Error("Membership record not found.");
    if (membership.status !== "ACTIVE") {
      const startDate = new Date();
      membership.status = "ACTIVE";
      membership.startedAt = startDate;
      membership.expiresAt = calculateExpiryDate(startDate, membership.plan);
      if (!membership.membershipNumber) membership.membershipNumber = generateMembershipNumber();
      await membership.save({ session });
    }
    return {
      result: { membership },
      type: "MEMBERSHIP",
      payload: [payment.user.toString(), membership.membershipNumber],
    };
  }

  if (payment.type === "MEETING") {
    const booking = await Booking.findById(payment.booking)
      .populate("meetingType")
      .session(session);
    if (!booking) throw new Error("Booking record not found.");
    if (booking.status === "PENDING_PAYMENT") {
      booking.status = "CONFIRMED";
      booking.confirmedAt = new Date();
      await booking.save({ session });
    }
    return {
      result: { booking },
      type: "MEETING",
      payload: [payment.user.toString(), booking.reference, booking.scheduledFor],
    };
  }

  if (payment.type === "GIFT") {
    const giftTransaction = await GiftTransaction.findById(payment.giftTransaction)
      .populate("gift")
      .session(session);
    if (!giftTransaction) throw new Error("Gift transaction record not found.");
    if (giftTransaction.status === "PENDING_PAYMENT") {
      giftTransaction.status = "COMPLETED";
      await giftTransaction.save({ session });
    }
    return {
      result: { transaction: giftTransaction },
      type: "GIFT",
      payload: [payment.user.toString(), giftTransaction.gift.name, giftTransaction.quantity],
    };
  }

  throw new Error(`Unsupported payment type: ${payment.type}`);
};

const settleSuccessfulPayment = async ({ paymentId, transaction, session }) => {
  const payment = await Payment.findById(paymentId).session(session);
  if (!payment) throw new Error("Payment not found.");

  if (payment.status === "SUCCESS") {
    return { alreadySettled: true, notification: null };
  }

  const { result, type, payload } = await buildSettlementNotification(payment, session);

  payment.status = "SUCCESS";
  payment.paidAt = new Date();
  payment.providerResponse = transaction || payment.providerResponse;
  payment.metadata = {
    ...(payment.metadata || {}),
    settledAt: new Date().toISOString(),
  };
  await payment.save({ session });

  return {
    alreadySettled: false,
    ...result,
    notification: { type, userId: payload[0], membershipNumber: payload[1], reference: payload[1], scheduledFor: payload[2], giftName: payload[1], quantity: payload[2] },
  };
};

const applyProviderTransactionDetails = (payment, transaction) => {
  if (!payment || !transaction) return payment;
  payment.metadata = {
    ...(payment.metadata || {}),
    providerTransactionId: transaction.id != null ? String(transaction.id) : undefined,
    providerStatus: transaction.status,
    providerAmount: transaction.amount,
    providerCurrency: transaction.currency,
    providerProcessorResponse: transaction.processor_response || transaction.narration,
  };
  return payment;
};

module.exports = {
  settleSuccessfulPayment,
  applyProviderTransactionDetails,
};
