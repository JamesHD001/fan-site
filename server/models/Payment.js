const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    type: {
      type: String,
      enum: ["DEPOSIT", "MEMBERSHIP", "MEETING", "GIFT"],
      required: true,
      index: true,
    },

    membership: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", default: null },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
    giftTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "GiftTransaction", default: null },

    reference: { type: String, required: true, unique: true, index: true },

    // Value the member is purchasing/receiving from the platform.
    originalAmount: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Original amount must be an integer minor-unit amount." } },
    originalCurrency: { type: String, default: "USD", uppercase: true, trim: true },

    // Exact amount requested from the external provider, in provider minor units.
    amount: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Provider amount must be an integer minor-unit amount." } },
    currency: { type: String, default: "NGN", uppercase: true, trim: true },

    // Locked conversion rate at initialization. Never recalculate during verification.
    exchangeRate: { type: Number, required: true, min: 0 },

    // Provider costs are settlement/accounting values, not part of payment validation.
    providerFee: { type: Number, default: null, min: 0 },
    providerTax: { type: Number, default: null, min: 0 },
    providerNetSettlement: { type: Number, default: null, min: 0 },

    provider: {
      type: String,
      enum: ["PAYSTACK", "FLUTTERWAVE", "BYBIT", "OTHER", "INTERNAL"],
      default: "INTERNAL",
      index: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "SUCCESS", "FAILED", "ABANDONED", "EXPIRED", "REFUNDED", "REVERSED"],
      default: "PENDING",
      index: true,
    },

    paidAt: { type: Date, default: null },
    providerTransactionId: { type: String, default: null, index: true },
    providerResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ provider: 1, providerTransactionId: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
