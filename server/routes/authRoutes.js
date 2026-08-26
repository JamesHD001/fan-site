const express = require("express");
const { register, verifyRegistration, login, getCurrentUser, updateCurrentUser } = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiters");
const { registerValidator, loginValidator } = require("../validators/authValidator");

const router = express.Router();
router.post("/register", authLimiter, registerValidator, validate, register);
router.post("/register/verify", authLimiter, verifyRegistration);
router.post("/login", authLimiter, loginValidator, validate, login);
router.get("/me", authenticate, getCurrentUser);
router.patch("/me", authenticate, updateCurrentUser);
module.exports = router;
