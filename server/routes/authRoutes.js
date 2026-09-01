const express = require("express");
const { register, verifyRegistration, login, verifyLoginOtp, getCurrentUser, updateCurrentUser, updateProfileImage, updateSecuritySettings, updatePhoneNumber, verifyPhoneNumber } = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiters");
const { registerValidator, loginValidator } = require("../validators/authValidator");

const router = express.Router();

// Registration and Login
router.post("/register", authLimiter, registerValidator, validate, register);
router.post("/register/verify", authLimiter, verifyRegistration);
router.post("/login", authLimiter, loginValidator, validate, login);
router.post("/login/otp", authLimiter, verifyLoginOtp);

// User Profile
router.get("/me", authenticate, getCurrentUser);
router.patch("/me", authenticate, updateCurrentUser);
router.patch("/me/photo", authenticate, authLimiter, updateProfileImage);

// Security Settings
router.patch("/me/security-settings", authenticate, updateSecuritySettings);

// Phone Number Management
router.patch("/me/phone", authenticate, updatePhoneNumber);
router.post("/me/phone/verify", authenticate, verifyPhoneNumber);

module.exports = router;
