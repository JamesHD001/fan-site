const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const { verifyTransaction } = require("../services/paystackService");
const { settleSuccessfulPayment } = require("../services/paymentSettlementService");
const { createNotification, notifyBookingConfirmed } = require("../services/notificationService");

const verifyBookingPayment = async (req, res) => {
  let session;
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ success: false, message: "Payment reference is required." });
    const payment = await Payment.findOne({ reference, user: req.user._id, type: "MEETING" });
    if (!payment) return res.status(404).json({ success: false, message: "Payment record not found." });
    if (payment.status === "SUCCESS") return res.status(200).json({ success: true, message: "Payment has already been verified.", payment, booking: await Booking.findById(payment.booking).populate("meetingType") });
    const transaction = (await verifyTransaction(reference)).data;
    if (transaction.reference !== payment.reference) return res.status(400).json({ success: false, message: "Payment reference mismatch." });
    if (Number(transaction.amount) !== Number(payment.amount)) return res.status(400).json({ success: false, message: "Payment amount mismatch." });
    if (!transaction.currency || transaction.currency.toUpperCase() !== payment.currency.toUpperCase()) return res.status(400).json({ success: false, message: "Payment currency mismatch." });
    if (transaction.status !== "success") { payment.status = transaction.status === "abandoned" ? "ABANDONED" : "FAILED"; payment.providerResponse = transaction; await payment.save(); return res.status(400).json({ success: false, message: "Payment was not successful.", status: transaction.status }); }
    session = await mongoose.startSession(); session.startTransaction();
    const settlement = await settleSuccessfulPayment({ paymentId: payment._id, transaction, session });
    await session.commitTransaction();
    if (!settlement.alreadySettled && settlement.notification) await notifyBookingConfirmed(settlement.notification.userId, settlement.notification.reference, settlement.notification.scheduledFor);
    return res.status(200).json({ success: true, message: settlement.alreadySettled ? "Payment has already been verified." : "Payment verified and booking confirmed successfully.", payment: settlement.payment, booking: settlement.result.booking });
  } catch (error) { if (session?.inTransaction()) await session.abortTransaction(); console.error("Verify booking payment error:", error); return res.status(500).json({ success: false, message: error.message || "Unable to verify booking payment." }); } finally { if (session) await session.endSession(); }
};

const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id }).populate("meetingType", "name");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    if (!["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status)) return res.status(400).json({ success: false, message: `A ${booking.status.toLowerCase()} booking cannot be cancelled.` });
    const previousStatus = booking.status;
    booking.status = "CANCELLED"; booking.cancelledAt = new Date(); await booking.save();
    await createNotification({ user: booking.user, type: "BOOKING", title: "Meeting booking cancelled", message: `Your ${booking.meetingType?.name || "meeting"} booking (${booking.reference}) has been cancelled.`, link: "/meetings" });
    return res.status(200).json({ success: true, message: "Booking cancelled successfully.", data: { booking, previousStatus } });
  } catch (error) { console.error("Cancel booking error:", error); return res.status(500).json({ success: false, message: "Unable to cancel booking." }); }
};
module.exports = { verifyBookingPayment, cancelBooking };
