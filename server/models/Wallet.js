const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // Platform credits are currently denominated in USD minor units (cents).
    // External funding currencies are recorded on the originating transaction.
    currency: {
      type: String,
      enum: ["USD"],
      default: "USD",
      immutable: true,
    },

    availableBalance: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Available balance must be an integer minor-unit amount.",
      },
    },

    pendingBalance: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Pending balance must be an integer minor-unit amount.",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Wallet", walletSchema);
