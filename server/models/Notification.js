const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "PAYMENT",
        "MEMBERSHIP",
        "BOOKING",
        "GIFT",
        "EVENT",
        "POST",
        "SYSTEM",
      ],
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    // Optional link/route for the frontend to navigate to
    link: {
      type: String,
      trim: true,
      default: "",
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for the common "unread inbox" query
notificationSchema.index({ user: 1, isRead: 1 });

module.exports = mongoose.model(
  "Notification",
  notificationSchema
);
