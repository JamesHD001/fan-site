const crypto = require("crypto");
const OtpVerification = require("../models/OtpVerification");
const { generateOtp, hashOtp, getOtpExpiry, MAX_ATTEMPTS, RESEND_COOLDOWN_MS, MAX_RESENDS } = require("../utils/otp");
const { sendOtpEmail } = require("./emailService");

const createOtp = async ({ email, user = null, purpose }) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await OtpVerification.findOne({ email: normalizedEmail, purpose }).sort({ createdAt: -1 });
  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) { const error = new Error("Please wait before requesting another OTP."); error.code = "OTP_COOLDOWN"; throw error; }
  if (existing && existing.resendCount >= MAX_RESENDS) { const error = new Error("OTP resend limit reached. Please try again later."); error.code = "OTP_RESEND_LIMIT"; throw error; }
  const otp = generateOtp();
  await OtpVerification.deleteMany({ email: normalizedEmail, purpose });
  const record = await OtpVerification.create({ email: normalizedEmail, user, purpose, otpHash: hashOtp(otp), expiresAt: getOtpExpiry(), lastSentAt: new Date(), resendCount: existing ? existing.resendCount + 1 : 0 });
  try { await sendOtpEmail({ to: normalizedEmail, otp, purpose }); } catch (error) { await record.deleteOne(); throw error; }
  return { record, otp };
};

const verifyOtp = async ({ email, purpose, otp }) => {
  const record = await OtpVerification.findOne({ email: String(email).trim().toLowerCase(), purpose });
  if (!record) return { valid: false, message: "Invalid or expired OTP." };
  if (record.expiresAt.getTime() <= Date.now()) { await record.deleteOne(); return { valid: false, message: "This OTP has expired." }; }
  if (record.attempts >= MAX_ATTEMPTS) return { valid: false, message: "Too many incorrect attempts. Request a new OTP." };
  const suppliedHash = Buffer.from(hashOtp(otp));
  const storedHash = Buffer.from(record.otpHash);
  if (!/^\d{6}$/.test(String(otp)) || suppliedHash.length !== storedHash.length || !crypto.timingSafeEqual(storedHash, suppliedHash)) { record.attempts += 1; await record.save(); return { valid: false, message: "Invalid OTP." }; }
  await record.deleteOne();
  return { valid: true };
};
module.exports = { createOtp, verifyOtp };
