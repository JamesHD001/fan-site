const express = require("express");

const authenticate = require("../middleware/authenticate");
const { verifyPayment } = require("../controllers/paymentController");
const {
  createFlutterwaveDeposit,
  verifyFlutterwavePayment,
  createSavedCardDeposit,
} = require("../controllers/flutterwavePaymentController");

const router = express.Router();

router.post("/verify", authenticate, verifyPayment);
router.post("/flutterwave/deposits", authenticate, createFlutterwaveDeposit);
router.post("/flutterwave/deposits/verify", authenticate, verifyFlutterwavePayment);
router.post("/flutterwave/deposits/saved-card", authenticate, createSavedCardDeposit);

module.exports = router;
