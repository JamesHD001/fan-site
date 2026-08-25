const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
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
        "MEMBERSHIP",
        "MEETING",
        "GIFT",
      ],
      required: true,
      index: true,
    },

    membership: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Membership",
      default: null,
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Original product price
    originalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    originalCurrency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true,
    },

    // Actual amount sent to the payment provider
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
      trim: true,
    },

    // USD → NGN rate used for this transaction
    exchangeRate: {
      type: Number,
      required: true,
      min: 0,
    },

    provider: {
      type: String,
      enum: ["PAYSTACK"],
      default: "PAYSTACK",
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "SUCCESS",
        "FAILED",
        "ABANDONED",
        "REFUNDED",
      ],
      default: "PENDING",
      index: true,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    providerTransactionId: {
      type: String,
      default: null,
    },

    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Payment",
  paymentSchema
);