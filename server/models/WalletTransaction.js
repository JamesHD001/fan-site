const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["DEPOSIT", "PURCHASE", "REFUND", "REVERSAL", "ADJUSTMENT"],
      required: true,
      index: true,
    },

    direction: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },

    // Platform credit amount in USD minor units.
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Wallet transaction amount must be an integer minor-unit amount.",
      },
    },

    currency: {
      type: String,
      enum: ["USD"],
      default: "USD",
    },

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED", "REVERSED"],
      default: "COMPLETED",
      index: true,
    },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
