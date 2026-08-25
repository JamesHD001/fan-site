const express = require("express");

const {
  getOverview,
  getRevenueTrend,
  getUserGrowth,
  getContentStats,
} = require("../controllers/analyticsController");

const authenticate = require("../middleware/authenticate");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

// All analytics routes are admin-only
router.use(authenticate, requireAdmin);

router.get("/overview", getOverview);
router.get("/revenue", getRevenueTrend);
router.get("/users", getUserGrowth);
router.get("/content", getContentStats);

module.exports = router;
