const crypto = require("crypto");
const TrustedDevice = require("../models/TrustedDevice");

const COOKIE_NAME = "fan_community_trusted_device";
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", maxAge: 30 * 24 * 60 * 60 * 1000, path: "/api/auth" });
const readCookie = (req) => { const header = req.headers.cookie || ""; const part = header.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${COOKIE_NAME}=`)); return part ? decodeURIComponent(part.slice(COOKIE_NAME.length + 1)) : null; };
const hashToken = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");
const clearCookie = (res) => res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });

const getTrustedDevices = async (req, res) => {
  try {
    await TrustedDevice.deleteMany({ user: req.user._id, expiresAt: { $lte: new Date() } });
    const currentHash = readCookie(req) ? hashToken(readCookie(req)) : null;
    const devices = await TrustedDevice.find({ user: req.user._id }).sort({ lastUsedAt: -1 }).lean();
    return res.json({ success: true, devices: devices.map((device) => ({ id: device._id, deviceName: device.deviceName, createdAt: device.createdAt, lastUsedAt: device.lastUsedAt, expiresAt: device.expiresAt, current: device.tokenHash === currentHash })) });
  } catch (error) { console.error("Trusted devices error:", error); return res.status(500).json({ success: false, message: "Unable to load trusted devices." }); }
};

const revokeTrustedDevice = async (req, res) => {
  try {
    const device = await TrustedDevice.findOne({ _id: req.params.id, user: req.user._id }).select("+tokenHash");
    if (!device) return res.status(404).json({ success: false, message: "Trusted device not found." });
    const currentToken = readCookie(req);
    const isCurrent = currentToken && device.tokenHash === hashToken(currentToken);
    await device.deleteOne();
    if (isCurrent) clearCookie(res);
    return res.json({ success: true, message: "Trusted device revoked." });
  } catch (error) { console.error("Revoke trusted device error:", error); return res.status(500).json({ success: false, message: "Unable to revoke trusted device." }); }
};

const revokeAllTrustedDevices = async (req, res) => {
  try { await TrustedDevice.deleteMany({ user: req.user._id }); clearCookie(res); return res.json({ success: true, message: "All trusted devices have been revoked." }); }
  catch (error) { console.error("Revoke all trusted devices error:", error); return res.status(500).json({ success: false, message: "Unable to revoke trusted devices." }); }
};

module.exports = { getTrustedDevices, revokeTrustedDevice, revokeAllTrustedDevices };
