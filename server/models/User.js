const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 30 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  profileImage: { type: String, default: "" },
  role: { type: String, enum: ["USER", "ADMIN", "MODERATOR"], default: "USER" },
  isPaymentSupport: { type: Boolean, default: false, index: true },
  isVerified: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null },

  // Phone verification
  phoneNumber: { type: String, default: null, trim: true },
  phoneNumberVerified: { type: Boolean, default: false },
  phoneVerificationToken: { type: String, default: null, select: false },

  // Two-Factor Authentication (2FA/TOTP) retained for future optional use.
  twoFactorEnabled: { type: Boolean, default: false, index: true },
  twoFactorSecret: { type: String, default: null, select: false },
  backupCodes: { type: [String], default: [], select: false },

  // Personal Security Key (PSK) for normal-member login.
  securityKeyHash: { type: String, default: null, select: false },
  securityKeyEnabled: { type: Boolean, default: false, index: true },

  // Legacy setting retained for compatibility with existing security-settings UI/API.
  requireOtpOnLogin: { type: Boolean, default: false },
  passwordChangedAt: { type: Date, default: null },
  loginAttempts: { type: Number, default: 0 },
  accountLockedUntil: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
