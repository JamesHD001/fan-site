const express = require("express");

const authenticate = require("../middleware/authenticate");
const { verifyPayment } = require("../controllers/paymentController");

const router = express.Router();

router.post("/verify", authenticate, verifyPayment);

module.exports = router;
