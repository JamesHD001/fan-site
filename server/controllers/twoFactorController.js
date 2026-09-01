const {
  generateTwoFactorSecret,
  verifyTotpToken,
  hashBackupCodes,
  verifyBackupCode,
  encryptTotpSecret,
  decryptTotpSecret,
} = require("../services/twoFactorService");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;

/**
 * Initialize 2FA setup - Generate QR code and backup codes
 */
const initiate2faSetup = async (req, res) => {
  try {
    if (req.user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is already enabled for this account.",
      });
    }

    const { secret, qrCode, backupCodes } = await generateTwoFactorSecret(
      req.user.username,
      req.user.email
    );

    // Return QR code and backup codes (but not encrypted secret yet)
    return res.json({
      success: true,
      message: "Two-factor setup initiated. Please scan the QR code with your authenticator app.",
      qrCode,
      backupCodes,
      // Store secret temporarily in response for immediate verification
      // Client should not store this permanently - it's only for immediate verification
      _tempSecret: secret,
    });
  } catch (error) {
    console.error("2FA setup initiation error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to initiate two-factor setup.",
    });
  }
};

/**
 * Verify 2FA setup - User verifies with TOTP code
 */
const verify2faSetup = async (req, res) => {
  try {
    const { totpToken, secret, backupCodes } = req.body;

    if (!totpToken || !secret || !backupCodes || !Array.isArray(backupCodes)) {
      return res.status(400).json({
        success: false,
        message: "TOTP token, secret, and backup codes are required.",
      });
    }

    if (backupCodes.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "All backup codes must be provided.",
      });
    }

    // Verify the TOTP token with the provided secret
    if (!verifyTotpToken(secret, totpToken)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code. Please check and try again.",
      });
    }

    // Hash backup codes for storage
    const hashedBackupCodes = await hashBackupCodes(backupCodes);

    // Encrypt the secret before storing
    const encryptedSecret = encryptTotpSecret(secret, ENCRYPTION_KEY);

    // Update user to enable 2FA
    req.user.twoFactorEnabled = true;
    req.user.twoFactorSecret = encryptedSecret;
    req.user.backupCodes = hashedBackupCodes;

    await req.user.save();

    return res.json({
      success: true,
      message: "Two-factor authentication has been enabled successfully.",
      user: {
        id: req.user._id,
        twoFactorEnabled: req.user.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error("2FA setup verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify two-factor setup.",
    });
  }
};

/**
 * Disable 2FA - Requires password confirmation
 */
const disable2fa = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required to disable two-factor authentication.",
      });
    }

    if (!req.user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is not enabled for this account.",
      });
    }

    // Verify password
    const { comparePassword } = require("../utils/password");
    const userWithPassword = await req.user.constructor
      .findById(req.user._id)
      .select("+password");
    if (!userWithPassword || !(await comparePassword(password, userWithPassword.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid password.",
      });
    }

    // Disable 2FA
    req.user.twoFactorEnabled = false;
    req.user.twoFactorSecret = null;
    req.user.backupCodes = [];
    req.user.requireOtpOnLogin = false; // Also disable OTP on login

    await req.user.save();

    return res.json({
      success: true,
      message: "Two-factor authentication has been disabled.",
      user: {
        id: req.user._id,
        twoFactorEnabled: req.user.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error("2FA disable error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to disable two-factor authentication.",
    });
  }
};

/**
 * Get 2FA status
 */
const get2faStatus = async (req, res) => {
  try {
    return res.json({
      success: true,
      twoFactorEnabled: req.user.twoFactorEnabled,
      requireOtpOnLogin: req.user.requireOtpOnLogin,
      backupCodesCount: req.user.backupCodes ? req.user.backupCodes.length : 0,
    });
  } catch (error) {
    console.error("2FA status error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve 2FA status.",
    });
  }
};

/**
 * Verify TOTP token during login (used as backup if OTP flow fails)
 */
const verifyTotpDuringLogin = async (req, res) => {
  try {
    const { totpToken } = req.body;

    if (!totpToken) {
      return res.status(400).json({
        success: false,
        message: "TOTP token is required.",
      });
    }

    if (!req.user.twoFactorEnabled || !req.user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is not enabled.",
      });
    }

    // Decrypt secret
    const decryptedSecret = decryptTotpSecret(req.user.twoFactorSecret, ENCRYPTION_KEY);

    // Verify token
    if (!verifyTotpToken(decryptedSecret, totpToken)) {
      return res.status(400).json({
        success: false,
        message: "Invalid TOTP token.",
      });
    }

    const { generateToken } = require("../utils/jwt");
    const sanitizeUser = require("../controllers/authController").sanitizeUser ||
      ((user) => ({
        id: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
      }));

    req.user.lastLogin = new Date();
    await req.user.save();

    return res.json({
      success: true,
      message: "Login successful.",
      token: generateToken(req.user),
      user: sanitizeUser(req.user),
    });
  } catch (error) {
    console.error("TOTP verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify TOTP token.",
    });
  }
};

/**
 * Use a backup code (for login fallback)
 */
const useBackupCode = async (req, res) => {
  try {
    const { backupCode } = req.body;

    if (!backupCode) {
      return res.status(400).json({
        success: false,
        message: "Backup code is required.",
      });
    }

    if (!req.user.twoFactorEnabled || !req.user.backupCodes || req.user.backupCodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No backup codes available.",
      });
    }

    // Verify backup code
    const { valid, index } = await verifyBackupCode(backupCode, req.user.backupCodes);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid backup code.",
      });
    }

    // Remove used backup code
    req.user.backupCodes.splice(index, 1);
    req.user.lastLogin = new Date();

    await req.user.save();

    const { generateToken } = require("../utils/jwt");
    const sanitizeUser = require("../controllers/authController").sanitizeUser ||
      ((user) => ({
        id: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
      }));

    return res.json({
      success: true,
      message: "Login successful.",
      token: generateToken(req.user),
      user: sanitizeUser(req.user),
      backupCodesRemaining: req.user.backupCodes.length,
    });
  } catch (error) {
    console.error("Backup code use error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to use backup code.",
    });
  }
};

/**
 * Regenerate backup codes
 */
const regenerateBackupCodes = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required to regenerate backup codes.",
      });
    }

    // Verify password
    const { comparePassword } = require("../utils/password");
    const userWithPassword = await req.user.constructor
      .findById(req.user._id)
      .select("+password");
    if (!userWithPassword || !(await comparePassword(password, userWithPassword.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid password.",
      });
    }

    // Generate new backup codes
    const { generateBackupCodes } = require("../services/twoFactorService");
    const newBackupCodes = generateBackupCodes(10);
    const hashedBackupCodes = await hashBackupCodes(newBackupCodes);

    req.user.backupCodes = hashedBackupCodes;
    await req.user.save();

    return res.json({
      success: true,
      message: "Backup codes have been regenerated. Save them in a safe place.",
      backupCodes: newBackupCodes,
    });
  } catch (error) {
    console.error("Backup codes regenerate error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to regenerate backup codes.",
    });
  }
};

module.exports = {
  initiate2faSetup,
  verify2faSetup,
  disable2fa,
  get2faStatus,
  verifyTotpDuringLogin,
  useBackupCode,
  regenerateBackupCodes,
};
