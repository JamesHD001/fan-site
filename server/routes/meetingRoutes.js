const express = require("express");

const {
  getMeetingTypes,
  getMyBookings,
  initializeBookingPayment,
} = require("../controllers/meetingController");

const {
  verifyBookingPayment,
  cancelBooking,
} = require("../controllers/bookingController");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

// Meeting types (public catalog)
router.get("/types", getMeetingTypes);

// Bookings
router.get(
  "/bookings",
  authenticate,
  getMyBookings
);

router.post(
  "/bookings/initialize",
  authenticate,
  initializeBookingPayment
);

router.post(
  "/bookings/verify",
  authenticate,
  verifyBookingPayment
);

router.patch(
  "/bookings/:id/cancel",
  authenticate,
  cancelBooking
);

module.exports = router;
