const express = require("express");

const {
  handlePaystackWebhook,
} = require("../controllers/paystackWebhookController");

const router = express.Router();

router.post(
  "/webhook",
  express.raw({
    type: "application/json",
  }),
  handlePaystackWebhook
);

module.exports = router;