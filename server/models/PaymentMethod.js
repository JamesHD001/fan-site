const mongoose = require("mongoose");

const paymentMethodSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["FLUTTERWAVE"], required: true, default: "FLUTTERWAVE" },
    type: { type: String, enum: ["CARD", "BANK_ACCOUNT"], required: true, default: "CARD" },

    // Never store PAN, CVV, or full expiry. Flutterwave owns the sensitive credential.
    token: { type: String, required: true, select: false },
    email: { type: String, required: true, lowercase: true, trim: true },
    brand: { type: String, default: null },
    last4: { type: String, default: null },
    expiryMonth: { type: Number, default: null, min: 1, max: 12 },
    expiryYear: { type: Number, default: null, min: 0 },

    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ["ACTIVE", "DISABLED"], default: "ACTIVE", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentMethodSchema.index({ user: 1, provider: 1, token: 1 }, { unique: true });
paymentMethodSchema.index({ user: 1, isDefault: 1 });

module.exports = mongoose.model("PaymentMethod", paymentMethodSchema);
