const crypto = require("crypto");
const { hashPassword, comparePassword } = require("../utils/password");

const SECURITY_KEY_LENGTH = 10;
const SECURITY_KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateSecurityKey = () => {
  const bytes = crypto.randomBytes(SECURITY_KEY_LENGTH);
  let key = "";
  for (const byte of bytes) key += SECURITY_KEY_ALPHABET[byte % SECURITY_KEY_ALPHABET.length];
  return key;
};

const normalizeSecurityKey = (value) => String(value || "").trim().toUpperCase();

const isValidSecurityKeyFormat = (value) => {
  const key = normalizeSecurityKey(value);
  return key.length >= 6 && key.length <= 10 && /^[A-Z0-9]+$/.test(key);
};

const hashSecurityKey = (key) => hashPassword(normalizeSecurityKey(key));
const compareSecurityKey = (key, hash) => comparePassword(normalizeSecurityKey(key), hash);

const generateTrustedDeviceToken = () => crypto.randomBytes(32).toString("hex");
const hashTrustedDeviceToken = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");

module.exports = {
  SECURITY_KEY_LENGTH,
  generateSecurityKey,
  normalizeSecurityKey,
  isValidSecurityKeyFormat,
  hashSecurityKey,
  compareSecurityKey,
  generateTrustedDeviceToken,
  hashTrustedDeviceToken
};
