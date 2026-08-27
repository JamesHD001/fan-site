const express = require("express");
const authenticate = require("../middleware/authenticate");
const { paymentVerifyLimiter } = require("../middleware/rateLimiters");
const { createFlutterwaveDeposit, verifyFlutterwavePayment } = require("../controllers/flutterwavePaymentController");

const router = express.Router();
router.post("/deposit", authenticate, paymentVerifyLimiter, createFlutterwaveDeposit);
router.post("/verify", authenticate, paymentVerifyLimiter, verifyFlutterwavePayment);
module.exports = router;
