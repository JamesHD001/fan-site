const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const { verifyTransaction } = require("../services/paystackService");
const { settleSuccessfulPayment } = require("../services/paymentSettlementService");
const {
  notifyMembershipActivated,
  notifyBookingConfirmed,
  notifyGiftCompleted,
} = require("../services/notificationService");

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

const verifyPayment = async (req, res) => {
  let session;

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
      provider: "PAYSTACK",
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found for this account.",
      });
    }

    if (payment.status === "SUCCESS") {
      session = await mongoose.startSession();
      session.startTransaction();

      const settlement = await settleSuccessfulPayment({
        paymentId: payment._id,
        transaction: payment.providerResponse || {},
        session,
      });

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Payment has already been verified.",
        type: payment.type,
        payment: settlement.payment,
        ...settlement.result,
      });
    }

    const paystackResponse = await verifyTransaction(reference);
    const transaction = paystackResponse.data;

    if (transaction.reference !== payment.reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference mismatch.",
      });
    }

    if (Number(transaction.amount) !== Number(payment.amount)) {
      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch.",
      });
    }

    if (
      !transaction.currency ||
      transaction.currency.toUpperCase() !== payment.currency.toUpperCase()
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment currency mismatch.",
      });
    }

    if (transaction.status !== "success") {
      payment.status =
        transaction.status === "abandoned" ? "ABANDONED" : "FAILED";
      payment.providerResponse = transaction;
      await payment.save();

      return res.status(400).json({
        success: false,
        message: "Payment was not successful.",
        status: transaction.status,
      });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const settlement = await settleSuccessfulPayment({
      paymentId: payment._id,
      transaction,
      session,
    });

    await session.commitTransaction();

    if (!settlement.alreadySettled) {
      await sendSettlementNotification(settlement.notification);
    }

    return res.status(200).json({
      success: true,
      message: `Payment verified and ${payment.type.toLowerCase()} payment settled successfully.`,
      type: payment.type,
      payment: settlement.payment,
      ...settlement.result,
    });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Verify payment error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to verify payment.",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

module.exports = {
  verifyPayment,
};
