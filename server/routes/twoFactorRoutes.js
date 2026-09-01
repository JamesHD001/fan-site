const express = require("express");
const authenticate = require("../middleware/authenticate");
const { authLimiter } = require("../middleware/rateLimiters");
const {
  initiate2faSetup,
  verify2faSetup,
  disable2fa,
  get2faStatus,
  verifyTotpDuringLogin,
  useBackupCode,
  regenerateBackupCodes,
} = require("../controllers/twoFactorController");

const router = express.Router();

// 2FA Setup and Status
router.get("/status", authenticate, get2faStatus);
router.post("/setup/initiate", authenticate, authLimiter, initiate2faSetup);
router.post("/setup/verify", authenticate, authLimiter, verify2faSetup);
router.post("/disable", authenticate, authLimiter, disable2fa);

// 2FA Verification (during login)
router.post("/verify-totp", authLimiter, verifyTotpDuringLogin);
router.post("/backup-code", authLimiter, useBackupCode);

// Backup Codes Management
router.post("/regenerate-backup-codes", authenticate, authLimiter, regenerateBackupCodes);

module.exports = router;
