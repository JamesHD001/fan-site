const { createOtp, verifyOtp } = require("../services/otpService");

const requestOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !["REGISTRATION", "PURCHASE"].includes(purpose)) return res.status(400).json({ success: false, message: "Email and a valid OTP purpose are required." });
    const result = await createOtp({ email, user: req.user?._id || null, purpose });
    const response = { success: true, message: "OTP generated successfully.", expiresAt: result.record.expiresAt };
    if (process.env.NODE_ENV !== "production" && process.env.OTP_EXPOSE_IN_DEVELOPMENT === "true") response.otp = result.otp;
    return res.status(201).json(response);
  } catch (error) {
    if (error.code === "OTP_COOLDOWN" || error.code === "OTP_RESEND_LIMIT") return res.status(429).json({ success: false, message: error.message });
    return res.status(500).json({ success: false, message: "Unable to generate OTP." });
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
