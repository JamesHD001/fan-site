const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const crypto = require("crypto");
const bcryptjs = require("bcryptjs");

const BACKUP_CODES_COUNT = 10;

/**
 * Generate a new TOTP secret for two-factor authentication
 * @param {string} username - User's username for QR code generation
 * @param {string} email - User's email for QR code generation
 * @returns {Promise<{secret: string, qrCode: string, backupCodes: string[]}>}
 */
const generateTwoFactorSecret = async (username, email) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Fan Site (${email})`,
      issuer: "Fan Site",
      length: 32,
    });

    const qrCode = await qrcode.toDataURL(secret.otpauth_url);
    const backupCodes = generateBackupCodes(BACKUP_CODES_COUNT);

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  } catch (error) {
    console.error("Error generating 2FA secret:", error);
    throw new Error("Unable to generate two-factor authentication secret.");
  }
};

/**
 * Verify a TOTP token
 * @param {string} secret - The user's TOTP secret
 * @param {string} token - The 6-digit token to verify
 * @returns {boolean}
 */
const verifyTotpToken = (secret, token) => {
  try {
    if (!/^\d{6}$/.test(String(token || ""))) return false;
    
    return speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 2, // Allow 1 time step before and after
    });
  } catch (error) {
    console.error("Error verifying TOTP token:", error);
    return false;
  }
};

/**
 * Generate backup recovery codes
 * @param {number} count - Number of backup codes to generate
 * @returns {string[]}
 */
const generateBackupCodes = (count = BACKUP_CODES_COUNT) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
  }
  return codes;
};

/**
 * Hash backup codes for secure storage
 * @param {string[]} codes - Array of backup codes
 * @returns {Promise<string[]>} - Array of hashed codes
 */
const hashBackupCodes = async (codes) => {
  try {
    const hashedCodes = await Promise.all(
      codes.map(code => bcryptjs.hash(code, 10))
    );
    return hashedCodes;
  } catch (error) {
    console.error("Error hashing backup codes:", error);
    throw new Error("Unable to hash backup codes.");
  }
};

/**
 * Verify a backup code
 * @param {string} code - The backup code to verify
 * @param {string[]} hashedCodes - Array of hashed backup codes from database
 * @returns {Promise<{valid: boolean, index: number}>} - Returns valid status and index of used code
 */
const verifyBackupCode = async (code, hashedCodes) => {
  try {
    for (let i = 0; i < hashedCodes.length; i++) {
      const isMatch = await bcryptjs.compare(code, hashedCodes[i]);
      if (isMatch) return { valid: true, index: i };
    }
    return { valid: false, index: -1 };
  } catch (error) {
    console.error("Error verifying backup code:", error);
    return { valid: false, index: -1 };
  }
};

/**
 * Encrypt TOTP secret for storage
 * @param {string} secret - The TOTP secret to encrypt
 * @param {string} encryptionKey - Encryption key (should come from environment)
 * @returns {string} - Encrypted secret
 */
const encryptTotpSecret = (secret, encryptionKey) => {
  try {
    const cipher = crypto.createCipher("aes-256-cbc", encryptionKey);
    let encrypted = cipher.update(secret, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  } catch (error) {
    console.error("Error encrypting TOTP secret:", error);
    throw new Error("Unable to encrypt two-factor secret.");
  }
};

/**
 * Decrypt TOTP secret for verification
 * @param {string} encryptedSecret - The encrypted TOTP secret
 * @param {string} encryptionKey - Encryption key (should come from environment)
 * @returns {string} - Decrypted secret
 */
const decryptTotpSecret = (encryptedSecret, encryptionKey) => {
  try {
    const decipher = crypto.createDecipher("aes-256-cbc", encryptionKey);
    let decrypted = decipher.update(encryptedSecret, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Error decrypting TOTP secret:", error);
    throw new Error("Unable to decrypt two-factor secret.");
  }
};

module.exports = {
  generateTwoFactorSecret,
  verifyTotpToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  encryptTotpSecret,
  decryptTotpSecret,
};
