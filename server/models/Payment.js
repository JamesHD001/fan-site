const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["MEMBERSHIP", "MEETING", "GIFT"], required: true, index: true },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", default: null },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  giftTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "GiftTransaction", default: null },
  reference: { type: String, required: true, unique: true, index: true },
  paymentToken: { type: String, required: true, unique: true, index: true },
  supportAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  originalAmount: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Amount must be an integer minor-unit amount." } },
  originalCurrency: { type: String, default: "USD", uppercase: true, trim: true },
  amount: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Amount must be an integer minor-unit amount." } },
  currency: { type: String, default: "USD", uppercase: true, trim: true },
  exchangeRate: { type: Number, default: 1, min: 0 },
  provider: { type: String, enum: ["INTERNAL"], default: "INTERNAL" },
  status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED", "CANCELLED", "EXPIRED"], default: "PENDING", index: true },
  paidAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ supportAdmin: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
