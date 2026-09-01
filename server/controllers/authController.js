const User = require("../models/User");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");
const { createOtp, verifyOtp } = require("../services/otpService");
const { notifyWelcome } = require("../services/notificationService");

const MAX_PROFILE_IMAGE_BYTES = 140 * 1024;
const PROFILE_IMAGE_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i;

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  profileImage: user.profileImage,
  role: user.role,
  isVerified: user.isVerified,
  emailVerified: user.emailVerified,
  isActive: user.isActive,
  lastLogin: user.lastLogin,
  phoneNumber: user.phoneNumber,
  phoneNumberVerified: user.phoneNumberVerified,
  twoFactorEnabled: user.twoFactorEnabled,
  requireOtpOnLogin: user.requireOtpOnLogin,
  createdAt: user.createdAt
});

const validateRegistrationInput = (body) => {
  const normalizedEmail = String(body?.email || "").trim().toLowerCase();
  const normalizedUsername = String(body?.username || "").trim().toLowerCase();
  const name = String(body?.name || "").trim();
  const password = String(body?.password || "");
  if (!name || name.length < 2 || name.length > 100) return null;
  if (!/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) return null;
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return null;
  if (password.length < 8) return null;
  return { normalizedEmail, normalizedUsername, name, password };
};

const register = async (req, res) => {
  try {
    const validated = validateRegistrationInput(req.body);
    if (!validated) return res.status(400).json({ success: false, message: "Please provide valid registration details." });
    const { normalizedEmail, normalizedUsername } = validated;
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] });
    if (existingUser) return res.status(409).json({ success: false, message: "Email or username is already registered." });
    await createOtp({ email: normalizedEmail, purpose: "REGISTRATION" });
    return res.status(202).json({ success: true, requiresOtp: true, message: "A verification code has been sent to your email address.", email: normalizedEmail });
  } catch (error) {
    console.error("Registration OTP error:", error);
    if (error.code === "OTP_COOLDOWN" || error.code === "OTP_RESEND_LIMIT") return res.status(429).json({ success: false, message: error.message });
    if (error.code === "EMAIL_NOT_CONFIGURED" || error.code === "EMAIL_DELIVERY_FAILED") return res.status(503).json({ success: false, message: "Email delivery is currently unavailable. Please try again later." });
    return res.status(500).json({ success: false, message: "Unable to start registration verification." });
  }
};

const verifyRegistration = async (req, res) => {
  try {
    const validated = validateRegistrationInput(req.body);
    if (!validated) return res.status(400).json({ success: false, message: "Please provide valid registration details." });
    const { normalizedEmail, normalizedUsername, name, password } = validated;
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: "Verification code is required." });
    const result = await verifyOtp({ email: normalizedEmail, purpose: "REGISTRATION", otp });
    if (!result.valid) return res.status(400).json({ success: false, message: result.message });
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] });
    if (existingUser) return res.status(409).json({ success: false, message: "Email or username is already registered." });
    const user = await User.create({
      name,
      username: normalizedUsername,
      email: normalizedEmail,
      password: await hashPassword(password),
      isVerified: true,
      emailVerified: true
    });
    await notifyWelcome(user._id, user.name);
    return res.status(201).json({ success: true, message: "Account created and email verified successfully.", token: generateToken(user), user: sanitizeUser(user) });
  } catch (error) {
    console.error("Registration verification error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify registration." });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password +loginAttempts +accountLockedUntil");
    if (!user) return res.status(401).json({ success: false, message: "Invalid email or password." });
    if (!user.isActive) return res.status(403).json({ success: false, message: "This account has been disabled." });

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil.getTime() > Date.now()) {
      return res.status(429).json({ success: false, message: "Account temporarily locked. Please try again later." });
    }

    if (!await comparePassword(password, user.password)) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
      }
      await user.save();
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    // Reset login attempts on successful password
    user.loginAttempts = 0;

    // Existing accounts created before email verification was required must verify
    // before a session token can be issued.
    if (!user.isVerified || !user.emailVerified) {
      await createOtp({ email: normalizedEmail, purpose: "ACCOUNT_VERIFICATION" });
      await user.save();
      return res.status(202).json({
        success: true,
        requiresOtp: true,
        otpPurpose: "ACCOUNT_VERIFICATION",
        message: "A verification code has been sent to your email. Please verify your account to continue.",
        email: normalizedEmail
      });
    }

    // Check if 2FA is required and enabled
    if (user.twoFactorEnabled && user.requireOtpOnLogin) {
      await createOtp({ email: normalizedEmail, purpose: "LOGIN" });
      await user.save();
      return res.status(202).json({
        success: true,
        requiresOtp: true,
        message: "A verification code has been sent to your email. Please verify to complete login.",
        email: normalizedEmail
      });
    }

    // OTP not required, complete login
    user.lastLogin = new Date();
    await user.save();
    return res.json({ success: true, message: "Login successful.", token: generateToken(user), user: sanitizeUser(user) });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Unable to login." });
  }
};
const getCurrentUser = async (req, res) => { try { return res.status(200).json({ success: true, user: sanitizeUser(req.user) }); } catch (error) { return res.status(500).json({ success: false, message: "Unable to retrieve user information." }); } };
const updateCurrentUser = async (req, res) => { try { const { name, username, email } = req.body; const updates = { name: String(name || "").trim(), username: String(username || "").trim().toLowerCase(), email: String(email || "").trim().toLowerCase() }; if (updates.name.length < 2 || updates.name.length > 100) return res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters." }); if (!/^[a-z0-9_]{3,30}$/.test(updates.username)) return res.status(400).json({ success: false, message: "Username can only contain letters, numbers, and underscores." }); if (!/^\S+@\S+\.\S+$/.test(updates.email)) return res.status(400).json({ success: false, message: "Please provide a valid email address." }); const duplicate = await User.findOne({ $or: [{ email: updates.email }, { username: updates.username }], _id: { $ne: req.user._id } }); if (duplicate) return res.status(409).json({ success: false, message: "Email or username is already in use." }); req.user.name = updates.name; req.user.username = updates.username; req.user.email = updates.email; await req.user.save(); return res.json({ success: true, message: "Profile updated successfully.", user: sanitizeUser(req.user) }); } catch (error) { return res.status(500).json({ success: false, message: "Unable to update your profile." }); } };

const updateProfileImage = async (req, res) => {
  try {
    const profileImage = String(req.body?.profileImage || "").trim();
    const match = profileImage.match(PROFILE_IMAGE_PATTERN);
    if (!match) return res.status(400).json({ success: false, message: "Please upload a valid JPEG, PNG or WebP image." });
    const imageBytes = Math.floor((match[2].length * 3) / 4) - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0);
    if (imageBytes <= 0 || imageBytes > MAX_PROFILE_IMAGE_BYTES) return res.status(413).json({ success: false, message: "Profile photo must be 140 KB or smaller after resizing." });
    req.user.profileImage = profileImage;
    await req.user.save();
    return res.json({ success: true, message: "Profile photo updated successfully.", user: sanitizeUser(req.user) });
  } catch (error) {
    console.error("Profile image update error:", error);
    return res.status(500).json({ success: false, message: "Unable to update your profile photo." });
  }
};

const verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp, purpose = "LOGIN" } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: "Email and verification code are required." });
    if (!["LOGIN", "ACCOUNT_VERIFICATION"].includes(purpose)) return res.status(400).json({ success: false, message: "Invalid verification request." });
    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await verifyOtp({ email: normalizedEmail, purpose, otp });
    if (!result.valid) return res.status(400).json({ success: false, message: result.message });
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: "Invalid email or password." });
    if (purpose === "ACCOUNT_VERIFICATION") {
      user.isVerified = true;
      user.emailVerified = true;
    }
    user.lastLogin = new Date();
    user.loginAttempts = 0;
    await user.save();
    return res.json({ success: true, message: "Login successful.", token: generateToken(user), user: sanitizeUser(user) });
  } catch (error) {
    console.error("Login OTP verification error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify OTP." });
  }
};

const updateSecuritySettings = async (req, res) => {
  try {
    const { requireOtpOnLogin } = req.body;
    if (typeof requireOtpOnLogin === "boolean") {
      req.user.requireOtpOnLogin = requireOtpOnLogin;
    }
    await req.user.save();
    return res.json({ success: true, message: "Security settings updated successfully.", user: sanitizeUser(req.user) });
  } catch (error) {
    console.error("Security settings update error:", error);
    return res.status(500).json({ success: false, message: "Unable to update security settings." });
  }
};

const updatePhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ success: false, message: "Phone number is required." });
    const normalizedPhone = String(phoneNumber).trim().replace(/\D/g, "");
    if (normalizedPhone.length < 10) return res.status(400).json({ success: false, message: "Please provide a valid phone number." });
    req.user.phoneNumber = normalizedPhone;
    req.user.phoneNumberVerified = false;
    await createOtp({ email: req.user.email, purpose: "PHONE_VERIFICATION" });
    await req.user.save();
    return res.json({ success: true, message: "A verification code has been sent to complete phone number update.", phoneNumber: normalizedPhone });
  } catch (error) {
    console.error("Phone number update error:", error);
    return res.status(500).json({ success: false, message: "Unable to update phone number." });
  }
};

const verifyPhoneNumber = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: "Verification code is required." });
    const result = await verifyOtp({ email: req.user.email, purpose: "PHONE_VERIFICATION", otp });
    if (!result.valid) return res.status(400).json({ success: false, message: result.message });
    req.user.phoneNumberVerified = true;
    await req.user.save();
    return res.json({ success: true, message: "Phone number verified successfully.", user: sanitizeUser(req.user) });
  } catch (error) {
    console.error("Phone verification error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify phone number." });
  }
};

module.exports = { register, verifyRegistration, login, verifyLoginOtp, getCurrentUser, updateCurrentUser, updateProfileImage, updateSecuritySettings, updatePhoneNumber, verifyPhoneNumber };
