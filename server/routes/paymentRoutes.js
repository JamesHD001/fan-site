const express = require("express");

const authenticate = require("../middleware/authenticate");
const { verifyPayment } = require("../controllers/paymentController");
const {
  initializeFlutterwaveDeposit,
  verifyFlutterwaveDeposit,
} = require("../controllers/flutterwavePaymentController");

const router = express.Router();

router.post("/verify", authenticate, verifyPayment);
router.post("/flutterwave/deposit", authenticate, initializeFlutterwaveDeposit);
router.get("/flutterwave/verify/:transactionId", authenticate, verifyFlutterwaveDeposit);

module.exports = router;
