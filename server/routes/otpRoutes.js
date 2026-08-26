const express = require("express");
const rateLimit = require("express-rate-limit");
const { requestOtp, verifyOtpCode } = require("../controllers/otpController");
const authenticate = require("../middleware/authenticate");

const router = express.Router();
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many OTP requests. Please try again later." } });

router.post("/request", otpLimiter, requestOtp);
router.post("/verify", otpLimiter, verifyOtpCode);
router.post("/purchase/request", otpLimiter, authenticate, requestOtp);
router.post("/purchase/verify", otpLimiter, authenticate, verifyOtpCode);

module.exports = router;
