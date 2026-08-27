const express = require("express");
const authenticate = require("../middleware/authenticate");
const { createFlutterwaveDeposit, verifyFlutterwavePayment } = require("../controllers/flutterwavePaymentController");

const router = express.Router();
router.post("/deposit", authenticate, createFlutterwaveDeposit);
router.post("/verify", authenticate, verifyFlutterwavePayment);
module.exports = router;
