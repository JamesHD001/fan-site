const express = require("express");

const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require("../controllers/notificationController");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.get("/", authenticate, getMyNotifications);
router.patch(
  "/read-all",
  authenticate,
  markAllAsRead
);
router.patch(
  "/:id/read",
  authenticate,
  markAsRead
);
router.delete("/:id", authenticate, deleteNotification);

module.exports = router;
