const Membership = require("../models/Membership");
const { createNotification } = require("./notificationService");

const expireMembershipIfNecessary = async (membership) => {
  if (!membership) return null;

  if (
    membership.status === "ACTIVE" &&
    membership.expiresAt &&
    membership.expiresAt <= new Date()
  ) {
    membership.status = "EXPIRED";
    membership.autoRenew = false;
    await membership.save();

    await createNotification({
      userId: membership.user.toString(),
      type: "MEMBERSHIP",
      title: "Membership expired",
      message: "Your membership has expired. Renew your membership to restore your community access.",
      link: "/membership",
    });
  }

  return membership;
};

const getMembershipState = (membership) => {
  if (!membership) return "NONE";
  if (membership.status === "EXPIRED") return "EXPIRED";
  if (membership.status === "CANCELLED") return "CANCELLED";
  if (membership.status === "PENDING") return "PENDING";
  if (membership.status !== "ACTIVE") return membership.status;

  if (membership.expiresAt) {
    const now = Date.now();
    const expiry = new Date(membership.expiresAt).getTime();
    const daysRemaining = Math.max(0, Math.ceil((expiry - now) / 86400000));

    if (daysRemaining <= 7) return "EXPIRING_SOON";
    return "ACTIVE";
  }

  return "ACTIVE";
};

const getMembershipDaysRemaining = (membership) => {
  if (!membership?.expiresAt) return null;

  const milliseconds = new Date(membership.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(milliseconds / 86400000));
};

module.exports = {
  expireMembershipIfNecessary,
  getMembershipState,
  getMembershipDaysRemaining,
};
