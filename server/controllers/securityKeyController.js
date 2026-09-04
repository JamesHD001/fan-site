const User = require("../models/User");
const TrustedDevice = require("../models/TrustedDevice");
const {
  generateSecurityKey,
  hashSecurityKey,
  compareSecurityKey,
  normalizeSecurityKey,
  isValidSecurityKeyFormat
} = require("../services/securityKeyService");

const rotateSecurityKey = async (req, res) => {
  try {
    const { currentSecurityKey } = req.body || {};
    const isAdmin = req.user.role === "ADMIN";

    if (!isAdmin) {
      if (!isValidSecurityKeyFormat(currentSecurityKey)) {
        return res.status(400).json({ success: false, message: "Enter your current Personal Security Key." });
      }

      const user = await User.findById(req.user._id).select("+securityKeyHash");
      if (!user?.securityKeyHash || !user.securityKeyEnabled) {
        return res.status(400).json({ success: false, message: "Your Personal Security Key is not currently enabled." });
      }

      const valid = await compareSecurityKey(normalizeSecurityKey(currentSecurityKey), user.securityKeyHash);
      if (!valid) return res.status(401).json({ success: false, message: "Current Personal Security Key is incorrect." });
    }

    const newSecurityKey = generateSecurityKey();
    const user = await User.findById(req.user._id);
    user.securityKeyHash = await hashSecurityKey(newSecurityKey);
    user.securityKeyEnabled = true;
    await user.save();

    // Rotating a key invalidates every remembered device so the old credential
    // cannot remain an authentication bypass after the key changes.
    await TrustedDevice.deleteMany({ user: user._id });

    return res.json({
      success: true,
      message: "Your Personal Security Key has been changed. Save the new key now; it will not be shown again.",
      securityKey: newSecurityKey
    });
  } catch (error) {
    console.error("Security key rotation error:", error);
    return res.status(500).json({ success: false, message: "Unable to change your Personal Security Key." });
  }
};

module.exports = { rotateSecurityKey };
