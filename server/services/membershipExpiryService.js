const Membership = require("../models/Membership");
const Notification = require("../models/Notification");

const REMINDER_WINDOWS = [30, 7, 1];

const dayKey = (days) => `membership-expiry:${days}`;

const sendMembershipExpiryReminders = async () => {
  const now = new Date();
  let sent = 0;

  for (const days of REMINDER_WINDOWS) {
    const start = new Date(now.getTime() + (days - 0.5) * 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() + (days + 0.5) * 24 * 60 * 60 * 1000);

    const memberships = await Membership.find({
      status: "ACTIVE",
      expiresAt: { $gte: start, $lt: end },
    }).populate("plan", "name");

    for (const membership of memberships) {
      const alreadySent = await Notification.exists({
        user: membership.user,
        type: "MEMBERSHIP",
        "metadata.key": dayKey(days),
        "metadata.membershipId": membership._id.toString(),
      });

      if (alreadySent) continue;

      await Notification.create({
        user: membership.user,
        type: "MEMBERSHIP",
        title: days === 1 ? "Membership expires tomorrow" : "Membership expiry reminder",
        message: days === 1
          ? `Your ${membership.plan?.name || "membership"} membership expires tomorrow. Renew to keep your member benefits active.`
          : `Your ${membership.plan?.name || "membership"} membership expires in ${days} days. Renew before it expires to keep your member benefits active.`,
        link: "/membership",
        metadata: {
          key: dayKey(days),
          membershipId: membership._id.toString(),
        },
      });
      sent += 1;
    }
  }

  return sent;
};

const expireMemberships = async () => {
  const result = await Membership.updateMany(
    { status: "ACTIVE", expiresAt: { $lte: new Date() } },
    { $set: { status: "EXPIRED" } }
  );
  return result.modifiedCount || 0;
};

const runMembershipMaintenance = async () => {
  const expired = await expireMemberships();
  const reminders = await sendMembershipExpiryReminders();
  if (expired || reminders) console.log(`Membership maintenance: ${expired} expired, ${reminders} reminders sent.`);
  return { expired, reminders };
};

module.exports = { runMembershipMaintenance, sendMembershipExpiryReminders, expireMemberships };
