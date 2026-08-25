const Notification = require("../models/Notification");

/*
 * Create a notification for a user.
 * Never throws — notification failures must not
 * break the main payment/booking/gift flow.
 */
const createNotification = async ({
  userId,
  type,
  title,
  message,
  link = "",
}) => {
  try {
    return await Notification.create({
      user: userId,
      type,
      title,
      message,
      link,
    });
  } catch (error) {
    console.error(
      "Create notification error:",
      error
    );

    return null;
  }
};

/*
 * Convenience helpers for payment success events.
 */
const notifyMembershipActivated = (
  userId,
  membershipNumber
) => {
  return createNotification({
    userId,
    type: "MEMBERSHIP",
    title: "Membership activated",
    message: `Your membership ${membershipNumber} is now active. Welcome to the community!`,
    link: "/membership",
  });
};

const notifyBookingConfirmed = (
  userId,
  bookingReference,
  scheduledFor
) => {
  return createNotification({
    userId,
    type: "BOOKING",
    title: "Meeting booking confirmed",
    message: `Your meeting (${bookingReference}) has been confirmed for ${new Date(scheduledFor).toLocaleString()}.`,
    link: "/meetings/bookings",
  });
};

const notifyGiftCompleted = (
  userId,
  giftName,
  quantity
) => {
  return createNotification({
    userId,
    type: "GIFT",
    title: "Gift sent successfully",
    message: `Your gift "${giftName}"${quantity > 1 ? ` (x${quantity})` : ""} was sent successfully. Thank you for your support!`,
    link: "/gifts/history",
  });
};

module.exports = {
  createNotification,
  notifyMembershipActivated,
  notifyBookingConfirmed,
  notifyGiftCompleted,
};
