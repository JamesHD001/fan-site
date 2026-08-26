const express = require("express");

const authenticate = require("../middleware/authenticate");
const { verifyPayment } = require("../controllers/paymentController");
const { authLimiter } = require("../middleware/rateLimiters");

router.post("/register", authLimiter, registerValidator, validate, register);
router.post("/login", authLimiter, loginValidator, validate, login);

const router = express.Router();

router.post("/verify", authenticate, verifyPayment);

module.exports = router;
