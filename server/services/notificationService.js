const Notification = require("../models/Notification");

/*
 * Create a notification for a user.
 * Notification failures must never break the main flow.
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
    console.error("Create notification error:", error);
    return null;
  }
};

const notifyMembershipActivated = (userId, membershipNumber) => (
  createNotification({
    userId,
    type: "MEMBERSHIP",
    title: "Membership activated",
    message: `Your membership ${membershipNumber} is now active. Welcome to the community!`,
    link: "/membership",
  })
);

const notifyBookingConfirmed = (userId, bookingReference, scheduledFor) => (
  createNotification({
    userId,
    type: "BOOKING",
    title: "Meeting booking confirmed",
    message: `Your meeting (${bookingReference}) has been confirmed for ${new Date(scheduledFor).toLocaleString()}.`,
    link: "/meetings",
  })
);

const notifyGiftCompleted = (userId, giftName, quantity) => (
  createNotification({
    userId,
    type: "GIFT",
    title: "Gift sent successfully",
    message: `Your gift "${giftName}"${quantity > 1 ? ` (x${quantity})` : ""} was sent successfully. Thank you for your support!`,
    link: "/gifts",
  })
);

module.exports = {
  createNotification,
  notifyMembershipActivated,
  notifyBookingConfirmed,
  notifyGiftCompleted,
};
