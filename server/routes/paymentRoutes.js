const express = require("express");

const authenticate = require("../middleware/authenticate");
const { verifyPayment } = require("../controllers/paymentController");
const {
  createFlutterwaveDeposit,
  verifyFlutterwavePayment,
} = require("../controllers/flutterwavePaymentController");
const { handleFlutterwaveWebhook } = require("../controllers/flutterwaveWebhookController");

const router = express.Router();

router.post("/verify", authenticate, verifyPayment);
router.post("/flutterwave/deposits", authenticate, createFlutterwaveDeposit);
router.post("/flutterwave/deposits/verify", authenticate, verifyFlutterwavePayment);
router.post("/flutterwave/webhook", handleFlutterwaveWebhook);

module.exports = router;
