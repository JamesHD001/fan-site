const express = require("express");

const {
  getGifts,
  getMyGiftHistory,
  initializeGiftPayment,
  verifyGiftPayment,
} = require("../controllers/giftController");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

// Gift catalog (public)
router.get("/", getGifts);

// Gift transactions
router.get(
  "/history",
  authenticate,
  getMyGiftHistory
);

router.post(
  "/initialize",
  authenticate,
  initializeGiftPayment
);

router.post(
  "/verify",
  authenticate,
  verifyGiftPayment
);

module.exports = router;
