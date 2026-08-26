const { runMembershipMaintenance } = require("../services/membershipExpiryService");

let running = false;

const startMembershipMaintenance = () => {
  const intervalMs = 60 * 60 * 1000;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runMembershipMaintenance();
    } catch (error) {
      console.error("Membership maintenance error:", error);
    } finally {
      running = false;
    }
  };

  // Run once shortly after startup, then hourly. The service itself is idempotent.
  setTimeout(run, 5000);
  setInterval(run, intervalMs);
};

module.exports = { startMembershipMaintenance };
