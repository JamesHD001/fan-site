const express = require("express");
const { register, verifyRegistration, login, verifyLoginOtp, logout, getTrustedDevices, revokeTrustedDevice, revokeAllTrustedDevices, getCurrentUser, updateCurrentUser, updateProfileImage, updateSecuritySettings, updatePhoneNumber, verifyPhoneNumber } = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiters");
const { registerValidator, loginValidator } = require("../validators/authValidator");

const router = express.Router();

router.post("/register", authLimiter, registerValidator, validate, register);
router.post("/register/verify", authLimiter, verifyRegistration);
router.post("/login", authLimiter, loginValidator, validate, login);
router.post("/login/otp", authLimiter, verifyLoginOtp);
router.post("/logout", logout);

router.get("/me", authenticate, getCurrentUser);
router.patch("/me", authenticate, updateCurrentUser);
router.patch("/me/photo", authenticate, authLimiter, updateProfileImage);

router.patch("/me/security-settings", authenticate, updateSecuritySettings);
router.get("/me/trusted-devices", authenticate, getTrustedDevices);
router.delete("/me/trusted-devices", authenticate, revokeAllTrustedDevices);
router.delete("/me/trusted-devices/:id", authenticate, revokeTrustedDevice);

router.patch("/me/phone", authenticate, updatePhoneNumber);
router.post("/me/phone/verify", authenticate, verifyPhoneNumber);

module.exports = router;
