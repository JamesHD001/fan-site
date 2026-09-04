const User = require("../models/User");
const TrustedDevice = require("../models/TrustedDevice");
const { hashPassword, comparePassword } = require("../utils/password");
const {
  compareSecurityKey,
  normalizeSecurityKey,
  isValidSecurityKeyFormat,
} = require("../services/securityKeyService");

const PASSWORD_MIN_LENGTH = 8;

const validateNewPassword = (password) => {
  const value = String(password || "");
  if (value.length < PASSWORD_MIN_LENGTH || value.length > 128) {
    return "Password must be between 8 and 128 characters.";
  }
  return null;
};

const revokeTrustedDevices = async (userId) => {
  await TrustedDevice.deleteMany({ user: userId });
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, securityKey } = req.body || {};
    const passwordError = validateNewPassword(newPassword);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    if (String(newPassword) === String(currentPassword || "")) {
      return res.status(400).json({ success: false, message: "Your new password must be different from your current password." });
    }

    const user = await User.findById(req.user._id).select("+password +securityKeyHash");
    if (!user) return res.status(404).json({ success: false, message: "Account not found." });

    const validPassword = await comparePassword(String(currentPassword || ""), user.password);
    if (!validPassword) return res.status(401).json({ success: false, message: "Current password is incorrect." });

    // Normal members must also prove possession of their Personal Security Key
    // before changing a password. Admins use their current password only.
    if (user.role !== "ADMIN") {
      if (!isValidSecurityKeyFormat(securityKey)) {
        return res.status(401).json({ success: false, requiresSecurityKey: true, message: "Enter your Personal Security Key to change your password." });
      }
      if (!user.securityKeyHash || !user.securityKeyEnabled) {
        return res.status(401).json({ success: false, requiresSecurityKey: true, message: "Your Personal Security Key is not enabled." });
      }
      const validKey = await compareSecurityKey(normalizeSecurityKey(securityKey), user.securityKeyHash);
      if (!validKey) return res.status(401).json({ success: false, requiresSecurityKey: true, message: "Personal Security Key is incorrect." });
    }

    user.password = await hashPassword(String(newPassword));
    user.passwordChangedAt = new Date();
    user.loginAttempts = 0;
    user.accountLockedUntil = null;
    await user.save();
    await revokeTrustedDevices(user._id);

    return res.json({
      success: true,
      message: "Password changed successfully. You have been signed out of remembered devices.",
      requiresLogin: true,
    });
  } catch (error) {
    console.error("Password change error:", error);
    return res.status(500).json({ success: false, message: "Unable to change your password." });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, username, securityKey, newPassword } = req.body || {};
    const identifier = String(email || username || "").trim().toLowerCase();
    const passwordError = validateNewPassword(newPassword);
    if (!identifier || !passwordError === false) {
      // Intentionally handled below so the same response shape is returned for
      // malformed recovery attempts without exposing account existence.
    }
    if (!identifier || passwordError || !isValidSecurityKeyFormat(securityKey)) {
      return res.status(400).json({ success: false, message: "Enter your email/username, Security Key, and a valid new password." });
    }

    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] }).select("+securityKeyHash");
    if (!user || !user.isActive || !user.securityKeyHash || !user.securityKeyEnabled) {
      return res.status(401).json({ success: false, message: "Unable to reset the password with the details provided." });
    }

    const validKey = await compareSecurityKey(normalizeSecurityKey(securityKey), user.securityKeyHash);
    if (!validKey) return res.status(401).json({ success: false, message: "Unable to reset the password with the details provided." });

    user.password = await hashPassword(String(newPassword));
    user.passwordChangedAt = new Date();
    user.loginAttempts = 0;
    user.accountLockedUntil = null;
    await user.save();
    await revokeTrustedDevices(user._id);

    return res.json({ success: true, message: "Password reset successfully. Sign in with your new password.", requiresLogin: true });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({ success: false, message: "Unable to reset your password." });
  }
};

module.exports = { changePassword, resetPassword };
