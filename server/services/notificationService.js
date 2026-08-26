const Notification = require("../models/Notification");

const createNotification = async ({ userId, user, type, title, message, link = "", metadata = null }) => {
  try {
    return await Notification.create({ user: userId || user, type, title, message, link, metadata });
  } catch (error) {
    console.error("Create notification error:", error);
    return null;
  }
};

const createNotifications = async (userIds, payload) => {
  if (!Array.isArray(userIds) || !userIds.length) return [];
  try {
    return await Notification.insertMany(userIds.map((userId) => ({ user: userId, ...payload })));
  } catch (error) {
    console.error("Create notifications error:", error);
    return [];
  }
};

const notifyMembershipActivated = (userId, membershipNumber) => createNotification({ userId, type: "MEMBERSHIP", title: "Membership activated", message: `Your membership ${membershipNumber} is now active. Welcome to the community!`, link: "/membership" });
const notifyBookingConfirmed = (userId, bookingReference, scheduledFor) => createNotification({ userId, type: "BOOKING", title: "Meeting booking confirmed", message: `Your meeting (${bookingReference}) has been confirmed for ${new Date(scheduledFor).toLocaleString()}.`, link: "/meetings" });
const notifyGiftCompleted = (userId, giftName, quantity) => createNotification({ userId, type: "GIFT", title: "Gift sent successfully", message: `Your gift \"${giftName}\"${quantity > 1 ? ` (x${quantity})` : ""} was sent successfully. Thank you for your support!`, link: "/gifts" });

module.exports = { createNotification, createNotifications, notifyMembershipActivated, notifyBookingConfirmed, notifyGiftCompleted };
