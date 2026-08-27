const express = require("express");
const authenticate = require("../middleware/authenticate");
const { getWallet, getWalletTransactions } = require("../services/walletService");

const router = express.Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    const wallet = await getWallet(req.user._id);
    return res.json({
      success: true,
      wallet: {
        id: wallet._id,
        currency: wallet.currency,
        availableBalance: wallet.availableBalance,
        pendingBalance: wallet.pendingBalance,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/transactions", authenticate, async (req, res, next) => {
  try {
    const result = await getWalletTransactions(req.user._id, req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
