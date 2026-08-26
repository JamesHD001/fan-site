const crypto = require("crypto");
const MeetingType = require("../models/MeetingType");
const Booking = require("../models/Booking");
const Membership = require("../models/Membership");
const Payment = require("../models/Payment");
const { initializeTransaction } = require("../services/paystackService");
const { convertUsdToNgn } = require("../services/paymentService");

const TIER_ORDER = ["FAN", "SUPPORTER", "INSIDER", "VIP"];

const generateBookingReference = () =>
  `BK-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const getActiveMembershipTier = async (userId) => {
  const membership = await Membership.findOne({
    user: userId,
    status: "ACTIVE",
    expiresAt: { $gt: new Date() },
  }).populate("plan", "minimumMeetingTier name");
  return membership?.plan || null;
};

const getMeetingTypes = async (req, res) => {
  try {
    const meetingTypes = await MeetingType.find({ isActive: true }).sort({
      sortOrder: 1,
      price: 1,
    });
    return res.status(200).json({ success: true, data: { meetingTypes } });
  } catch (error) {
    console.error("Get meeting types error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve meeting types.",
    });
  }
};

const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate("meetingType", "name slug duration price currency minimumMembershipTier")
      .sort({ scheduledFor: -1 });
    return res.status(200).json({ success: true, data: { bookings } });
  } catch (error) {
    console.error("Get bookings error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve bookings.",
    });
  }
};

const initializeBookingPayment = async (req, res) => {
  try {
    const { meetingTypeId, scheduledFor, notes } = req.body;
    if (!meetingTypeId || !scheduledFor) {
      return res.status(400).json({
        success: false,
        message: "Meeting type and preferred date/time are required.",
      });
    }

    const slotDate = new Date(scheduledFor);
    if (Number.isNaN(slotDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date/time provided for the meeting.",
      });
    }
    if (slotDate.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Meeting date must be in the future.",
      });
    }

    const meetingType = await MeetingType.findOne({
      _id: meetingTypeId,
      isActive: true,
    });
    if (!meetingType) {
      return res.status(404).json({
        success: false,
        message: "Meeting type not found.",
      });
    }

    const plan = await getActiveMembershipTier(req.user._id);
    const requiredTier = meetingType.minimumMembershipTier;
    if (!plan) {
      return res.status(403).json({
        success: false,
        message: "An active membership is required to book a meeting.",
      });
    }
    if (
      TIER_ORDER.indexOf(plan.minimumMeetingTier) <
      TIER_ORDER.indexOf(requiredTier)
    ) {
      return res.status(403).json({
        success: false,
        message: `The ${meetingType.name} requires at least a ${requiredTier} membership.`,
      });
    }

    const existingBooking = await Booking.findOne({
      scheduledFor: slotDate,
      status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] },
    });
    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: "That time slot is no longer available. Please choose another.",
      });
    }

    const reference = generateBookingReference();
    const { ngnAmountMinor, exchangeRate } = await convertUsdToNgn(
      meetingType.price
    );

    const booking = await Booking.create({
      user: req.user._id,
      meetingType: meetingType._id,
      reference,
      scheduledFor: slotDate,
      notes: notes || "",
      status: "PENDING_PAYMENT",
    });

    const payment = await Payment.create({
      user: req.user._id,
      type: "MEETING",
      booking: booking._id,
      reference,
      originalAmount: meetingType.price,
      originalCurrency: meetingType.currency,
      amount: ngnAmountMinor,
      currency: "NGN",
      exchangeRate,
      provider: "PAYSTACK",
      status: "PENDING",
    });

    booking.payment = payment._id;
    await booking.save();

    try {
      const paystackResponse = await initializeTransaction({
        email: req.user.email,
        amount: ngnAmountMinor,
        currency: "NGN",
        reference,
        metadata: JSON.stringify({
          paymentId: payment._id.toString(),
          bookingId: booking._id.toString(),
          userId: req.user._id.toString(),
          meetingTypeId: meetingType._id.toString(),
        }),
        callbackUrl: `${process.env.CLIENT_URL}/payment/callback`,
      });

      return res.status(201).json({
        success: true,
        message: "Booking payment initialized successfully.",
        booking: {
          id: booking._id,
          reference,
          scheduledFor: booking.scheduledFor,
          status: booking.status,
          meetingType: {
            id: meetingType._id,
            name: meetingType.name,
            duration: meetingType.duration,
            price: meetingType.price,
            currency: meetingType.currency,
          },
        },
        payment: {
          amount: ngnAmountMinor,
          currency: "NGN",
          exchangeRate,
        },
        checkout: {
          authorizationUrl: paystackResponse.data.authorization_url,
          accessCode: paystackResponse.data.access_code,
          reference: paystackResponse.data.reference,
        },
      });
    } catch (paystackError) {
      await Payment.findByIdAndUpdate(payment._id, { status: "FAILED" });
      await Booking.findByIdAndUpdate(booking._id, {
        status: "CANCELLED",
        cancelledAt: new Date(),
      });
      throw paystackError;
    }
  } catch (error) {
    console.error("Initialize booking payment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to initialize booking payment.",
    });
  }
};

module.exports = { getMeetingTypes, getMyBookings, initializeBookingPayment };
