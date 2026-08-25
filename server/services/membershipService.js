const Membership = require("../models/Membership");

const expireMembershipIfNecessary = async (membership) => {
  if (!membership) {
    return null;
  }

  if (
    membership.status === "ACTIVE" &&
    membership.expiresAt &&
    membership.expiresAt <= new Date()
  ) {
    membership.status = "EXPIRED";

    await membership.save();
  }

  return membership;
};

module.exports = {
  expireMembershipIfNecessary,
};