const mongoose = require("mongoose");

const trustedDeviceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  deviceName: { type: String, default: "Trusted device", trim: true, maxlength: 100 },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true }
});

module.exports = mongoose.model("TrustedDevice", trustedDeviceSchema);
