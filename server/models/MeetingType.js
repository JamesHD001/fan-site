const mongoose = require("mongoose");

const meetingTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    // Price stored in currency minor units.
    // Example: 250000 USD = $2,500.00.
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Price must be stored as an integer minor-unit amount.",
      },
    },

    currency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true,
    },

    minimumMembershipTier: {
      type: String,
      enum: ["FAN", "SUPPORTER", "INSIDER", "VIP"],
      default: "FAN",
    },

    maxParticipants: {
      type: Number,
      default: 1,
      min: 1,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("MeetingType", meetingTypeSchema);
