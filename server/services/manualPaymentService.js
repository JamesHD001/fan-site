const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Membership = require("../models/Membership");
const Booking = require("../models/Booking");
const GiftTransaction = require("../models/GiftTransaction");
const { calculateExpiryDate, generateMembershipNumber } = require("../utils/membership");
const { notifyMembershipActivated, notifyBookingConfirmed, notifyGiftCompleted, createNotification } = require("./notificationService");

const markManualPaymentSuccessful = async ({ paymentId, adminId, adminNote = "" }) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) throw new Error("Payment request not found.");
    if (payment.status === "SUCCESS") { await session.commitTransaction(); return { payment, alreadySettled: true }; }
    if (payment.status !== "PENDING") throw new Error(`Payment is ${payment.status} and cannot be confirmed.`);

    payment.status = "SUCCESS";
    payment.paidAt = new Date();
    payment.provider = "INTERNAL";
    payment.metadata = { ...(payment.metadata || {}), confirmedBy: adminId.toString(), confirmedAt: new Date().toISOString(), adminNote: adminNote.trim() };
    let result = {};

    if (payment.type === "MEMBERSHIP") {
      const membership = await Membership.findById(payment.membership).populate("plan").session(session);
      if (!membership) throw new Error("Membership record not found.");
      if (membership.status !== "ACTIVE") {
        const startDate = new Date();
        membership.status = "ACTIVE";
        membership.startedAt = startDate;
        membership.expiresAt = calculateExpiryDate(startDate, membership.plan);
        if (!membership.membershipNumber) membership.membershipNumber = generateMembershipNumber();
        await membership.save({ session });
      }
      result.membership = membership;
      await createNotification({ user: payment.user, type: "PAYMENT", title: "Payment confirmed", message: `Your membership payment (${payment.reference}) has been confirmed successfully.`, link: "/membership", metadata: { paymentId: payment._id.toString() } });
      await notifyMembershipActivated(payment.user.toString(), membership.membershipNumber);
    } else if (payment.type === "MEETING") {
      const booking = await Booking.findById(payment.booking).populate("meetingType").session(session);
      if (!booking) throw new Error("Booking record not found.");
      if (booking.status === "PENDING_PAYMENT") { booking.status = "CONFIRMED"; booking.confirmedAt = new Date(); await booking.save({ session }); }
      result.booking = booking;
      await createNotification({ user: payment.user, type: "PAYMENT", title: "Payment confirmed", message: `Your meeting payment (${payment.reference}) has been confirmed and your booking is now confirmed.`, link: "/meetings", metadata: { paymentId: payment._id.toString() } });
      await notifyBookingConfirmed(payment.user.toString(), booking.reference, booking.scheduledFor);
    } else if (payment.type === "GIFT") {
      const giftTransaction = await GiftTransaction.findById(payment.giftTransaction).populate("gift").session(session);
      if (!giftTransaction) throw new Error("Gift transaction not found.");
      if (giftTransaction.status === "PENDING_PAYMENT") { giftTransaction.status = "COMPLETED"; await giftTransaction.save({ session }); }
      result.transaction = giftTransaction;
      await createNotification({ user: payment.user, type: "PAYMENT", title: "Payment confirmed", message: `Your gift payment (${payment.reference}) has been confirmed successfully.`, link: "/gifts", metadata: { paymentId: payment._id.toString() } });
      await notifyGiftCompleted(payment.user.toString(), giftTransaction.gift.name, giftTransaction.quantity);
    } else throw new Error(`Unsupported manual payment type: ${payment.type}`);

    await payment.save({ session });
    await session.commitTransaction();
    return { payment, alreadySettled: false, ...result };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally { await session.endSession(); }
};

module.exports = { markManualPaymentSuccessful };
