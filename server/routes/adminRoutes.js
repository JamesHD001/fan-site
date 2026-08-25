const express = require("express");

const {
  getDashboardStats,
  getUsers,
  setUserActiveStatus,
  getPayments,
  getBookings,
  updateBookingStatus,
  getPendingPosts,
  moderatePost,
} = require("../controllers/adminController");

const authenticate = require("../middleware/authenticate");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate, requireAdmin);

// Dashboard
router.get("/dashboard", getDashboardStats);

// Users
router.get("/users", getUsers);
router.patch(
  "/users/:id/status",
  setUserActiveStatus
);

// Payments
router.get("/payments", getPayments);

// Bookings
router.get("/bookings", getBookings);
router.patch(
  "/bookings/:id/status",
  updateBookingStatus
);

// Post moderation
router.get("/posts/pending", getPendingPosts);
router.patch(
  "/posts/:id/moderate",
  moderatePost
);

module.exports = router;
