const express = require("express");
const { handleFlutterwaveWebhook } = require("../controllers/flutterwaveWebhookController");
const router = express.Router();
router.post("/webhook", express.raw({ type: "application/json" }), handleFlutterwaveWebhook);
module.exports = router;
