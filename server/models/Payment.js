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

    // Amount representing the platform product/credit in minor units.
    originalAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: "Original amount must be an integer minor-unit amount." },
    },
    originalCurrency: { type: String, default: "USD", uppercase: true, trim: true },

    // Amount actually charged by the external provider, in provider minor units.
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: "Amount must be an integer minor-unit amount." },
    },
    currency: { type: String, default: "NGN", uppercase: true, trim: true },

    // Major-unit conversion rate used when the provider currency differs from the platform currency.
    exchangeRate: { type: Number, required: true, min: 0 },

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
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
