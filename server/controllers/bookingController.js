const Booking = require("../models/Booking");
const Payment = require("../models/Payment");

const { verifyTransaction } = require("../services/paystackService");
const { notifyBookingConfirmed } = require("../services/notificationService");
const { toSubunit } = require("../utils/currency");

/*
 * Authenticated: verify a booking payment by reference.
 * Mirrors the membership verification flow.
 */
const verifyBookingPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required.",
      });
    }

    const payment = await Payment.findOne({
      reference,
      user: req.user._id,
      type: "MEETING",
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found.",
      });
    }

    // Idempotency
    if (payment.status === "SUCCESS") {
      const booking = await Booking.findById(
        payment.booking
      ).populate("meetingType");

      return res.status(200).json({
        success: true,
        message: "Payment has already been verified.",
        payment,
        booking,
      });
    }

    const paystackResponse =
      await verifyTransaction(reference);

    const transaction = paystackResponse.data;

    if (transaction.reference !== payment.reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference mismatch.",
      });
    }

    const expectedAmount = toSubunit(
      payment.amount,
      payment.currency
    );

    if (Number(transaction.amount) !== expectedAmount) {
      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch.",
      });
    }

    if (
      transaction.currency.toUpperCase() !==
      payment.currency.toUpperCase()
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment currency mismatch.",
      });
    }

    if (transaction.status !== "success") {
      payment.status =
        transaction.status === "abandoned"
          ? "ABANDONED"
          : "FAILED";

      payment.providerResponse = transaction;

      await payment.save();

      return res.status(400).json({
        success: false,
        message: "Payment was not successful.",
        status: transaction.status,
      });
    }

    const booking = await Booking.findById(
      payment.booking
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking record not found.",
      });
    }

    if (booking.status !== "CONFIRMED") {
      booking.status = "CONFIRMED";
      booking.confirmedAt = new Date();
      await booking.save();
    }

    payment.status = "SUCCESS";
    payment.paidAt = transaction.paid_at
      ? new Date(transaction.paid_at)
      : new Date();
    payment.providerTransactionId =
      String(transaction.id);
    payment.providerResponse = transaction;

    await payment.save();

    await notifyBookingConfirmed(
      req.user._id.toString(),
      booking.reference,
      booking.scheduledFor
    );

    await booking.populate(
      "meetingType",
      "name duration price currency"
    );

    return res.status(200).json({
      success: true,
      message:
        "Payment verified and booking confirmed successfully.",
      booking,
    });
  } catch (error) {
    console.error("Verify booking payment error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to verify booking payment.",
    });
  }
};

/*
 * Authenticated: cancel own pending/confirmed booking.
 */
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    if (
      !["PENDING_PAYMENT", "CONFIRMED"].includes(
        booking.status
      )
    ) {
      return res.status(400).json({
        success: false,
        message: `A ${booking.status.toLowerCase()} booking cannot be cancelled.`,
      });
    }

    booking.status = "CANCELLED";
    booking.cancelledAt = new Date();
    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
      data: { booking },
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to cancel booking.",
    });
  }
};

module.exports = {
  verifyBookingPayment,
  cancelBooking,
};
