const express = require("express");

const authenticate = require("../middleware/authenticate");
const { verifyPayment } = require("../controllers/paymentController");
const {
  createFlutterwaveDeposit,
  verifyFlutterwavePayment,
} = require("../controllers/flutterwavePaymentController");

const router = express.Router();

router.post("/verify", authenticate, verifyPayment);
router.post("/flutterwave/deposits", authenticate, createFlutterwaveDeposit);
router.post("/flutterwave/deposits/verify", authenticate, verifyFlutterwavePayment);

module.exports = router;
