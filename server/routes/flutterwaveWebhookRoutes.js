const express = require("express");
const { handleFlutterwaveWebhook } = require("../controllers/flutterwaveWebhookController");

const router = express.Router();

// Signature validation requires the unparsed JSON body.
router.post("/webhook", express.raw({ type: "application/json", limit: "1mb" }), handleFlutterwaveWebhook);

module.exports = router;
