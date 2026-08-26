const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    meetingType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeetingType",
      required: true,
    },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Requested date & time slot for the meeting
    scheduledFor: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "CONFIRMED",
        "COMPLETED",
        "CANCELLED",
        "DECLINED",
      ],
      default: "PENDING_PAYMENT",
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    adminNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    confirmedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Only paid/active bookings reserve a slot. Cancelled and declined bookings
// must not block the slot for future customers.
bookingSchema.index(
  { scheduledFor: 1 },
  {
    name: "active_booking_slot_unique",
    unique: true,
    partialFilterExpression: {
      status: { $in: ["PENDING_PAYMENT", "CONFIRMED", "COMPLETED"] },
    },
  }
);

module.exports = mongoose.model("Booking", bookingSchema);
