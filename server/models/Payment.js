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

    // All monetary amounts are stored in currency minor units.
    // Example: 3500 USD = $35.00; 5250000 NGN = ₦52,500.00.
    originalAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Original amount must be an integer minor-unit amount.",
      },
    },

    originalCurrency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true,
    },

    // Actual amount sent to the payment provider, in minor units.
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Amount must be an integer minor-unit amount.",
      },
    },

    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
      trim: true,
    },

    // USD → NGN rate used for this transaction.
    // This remains a major-unit exchange rate, e.g. 1500 NGN per 1 USD.
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

module.exports = mongoose.model("Payment", paymentSchema);
