const express = require("express");
const { handlePaystackWebhook } = require("../controllers/paystackWebhookController");

const router = express.Router();

// Signature validation requires the unparsed JSON body.
router.post("/webhook", express.raw({ type: "application/json", limit: "1mb" }), handlePaystackWebhook);

module.exports = router;
