const express = require("express");

const {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
} = require("../controllers/eventController");

const authenticate = require("../middleware/authenticate");
const optionalAuth = require("../middleware/optionalAuth");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

// Public listing (admins see drafts too)
router.get("/", optionalAuth, getEvents);
router.get("/:id", optionalAuth, getEventById);

// Admin management
router.post(
  "/",
  authenticate,
  requireAdmin,
  createEvent
);
router.patch(
  "/:id",
  authenticate,
  requireAdmin,
  updateEvent
);
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  deleteEvent
);

module.exports = router;
