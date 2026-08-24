const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    celebrityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Celebrity",
      required: true,
    },

    title: {
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

    image: {
      type: String,
      default: "",
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    capacity: {
      type: Number,
      required: true,
      min: 1,
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

    minimumMembershipTier: {
      type: String,
      enum: ["FAN", "SUPPORTER", "INSIDER", "VIP"],
      default: "FAN",
    },

    status: {
      type: String,
      enum: ["DRAFT", "UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Event", eventSchema);