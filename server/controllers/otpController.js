const { createOtp, verifyOtp } = require("../services/otpService");

const requestOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !["REGISTRATION", "PURCHASE"].includes(purpose)) return res.status(400).json({ success: false, message: "Email and a valid OTP purpose are required." });
    const result = await createOtp({ email, user: req.user?._id || null, purpose });
    return res.status(201).json({ success: true, message: "A verification code has been sent to your email address.", expiresAt: result.record.expiresAt });
  } catch (error) {
    if (error.code === "OTP_COOLDOWN" || error.code === "OTP_RESEND_LIMIT") return res.status(429).json({ success: false, message: error.message });
    if (error.code === "EMAIL_NOT_CONFIGURED" || error.code === "EMAIL_DELIVERY_FAILED") return res.status(503).json({ success: false, message: "Email delivery is currently unavailable. Please try again later." });
    return res.status(500).json({ success: false, message: "Unable to send OTP." });
  }
};

const verifyOtpCode = async (req, res) => {
  try {
    const { email, purpose, otp } = req.body;
    if (!email || !purpose || !otp) return res.status(400).json({ success: false, message: "Email, purpose and OTP are required." });
    const result = await verifyOtp({ email, purpose, otp });
    if (!result.valid) return res.status(400).json({ success: false, message: result.message });
    return res.json({ success: true, verified: true, message: "OTP verified successfully." });
  } catch { return res.status(500).json({ success: false, message: "Unable to verify OTP." }); }
};
module.exports = { requestOtp, verifyOtpCode };
