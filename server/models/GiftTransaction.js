const mongoose = require("mongoose");

const giftTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    gift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gift",
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

    // Snapshot of the total gift price at purchase time, in minor units.
    // Example: 5000 USD = $50.00.
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Amount must be stored as an integer minor-unit amount.",
      },
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "COMPLETED",
        "CANCELLED",
        "FAILED",
      ],
      default: "PENDING_PAYMENT",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "GiftTransaction",
  giftTransactionSchema
);
