const User = require("../models/User");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");
const { createOtp, verifyOtp } = require("../services/otpService");

const MAX_PROFILE_IMAGE_BYTES = 140 * 1024;
const PROFILE_IMAGE_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i;

const sanitizeUser = (user) => ({ id: user._id, name: user.name, username: user.username, email: user.email, profileImage: user.profileImage, role: user.role, isVerified: user.isVerified, isActive: user.isActive, lastLogin: user.lastLogin, createdAt: user.createdAt });

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
    const result = await verifyOtp({ email: normalizedEmail, purpose: "REGISTRATION", otp });
    if (!result.valid) return res.status(400).json({ success: false, message: result.message });
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] });
    if (existingUser) return res.status(409).json({ success: false, message: "Email or username is already registered." });
    const user = await User.create({ name, username: normalizedUsername, email: normalizedEmail, password: await hashPassword(password), isVerified: true });
    return res.status(201).json({ success: true, message: "Account created and email verified successfully.", token: generateToken(user), user: sanitizeUser(user) });
  } catch (error) { console.error("Registration verification error:", error); return res.status(500).json({ success: false, message: "Unable to verify registration." }); }
};

const login = async (req, res) => { try { const { email, password } = req.body; const normalizedEmail = String(email || "").trim().toLowerCase(); const user = await User.findOne({ email: normalizedEmail }).select("+password"); if (!user) return res.status(401).json({ success: false, message: "Invalid email or password." }); if (!user.isActive) return res.status(403).json({ success: false, message: "This account has been disabled." }); if (!await comparePassword(password, user.password)) return res.status(401).json({ success: false, message: "Invalid email or password." }); user.lastLogin = new Date(); await user.save(); return res.json({ success: true, message: "Login successful.", token: generateToken(user), user: sanitizeUser(user) }); } catch (error) { console.error("Login error:", error); return res.status(500).json({ success: false, message: "Unable to login." }); }
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

module.exports = { register, verifyRegistration, login, getCurrentUser, updateCurrentUser, updateProfileImage };
