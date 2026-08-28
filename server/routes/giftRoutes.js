const express = require("express");
const { getGifts, getMyGiftHistory } = require("../controllers/giftController");
const { requestPayment } = require("../controllers/manualPaymentController");
const authenticate = require("../middleware/authenticate");
const router = express.Router();
router.get("/", getGifts);
router.get("/history", authenticate, getMyGiftHistory);
router.post("/initialize", authenticate, (req, res) => { req.body.type = "GIFT"; req.body.itemId = req.body.giftId; return requestPayment(req, res); });
module.exports = router;
