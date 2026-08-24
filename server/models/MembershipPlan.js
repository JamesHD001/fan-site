const mongoose = require("mongoose");

const membershipPlanSchema = new mongoose.Schema(
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

    price: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        default: "USD",
        uppercase: true,
        trim: true,
    },

    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    durationUnit: {
      type: String,
      enum: ["DAY", "MONTH", "YEAR"],
      default: "YEAR",
    },

    benefits: {
      type: [String],
      default: [],
    },

    badge: {
      type: String,
      default: "",
    },

    cardDesign: {
      type: String,
      default: "",
    },

    minimumMeetingTier: {
      type: String,
      enum: ["FAN", "SUPPORTER", "INSIDER", "VIP"],
      default: "FAN",
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

module.exports = mongoose.model("MembershipPlan", membershipPlanSchema);