const crypto = require("crypto");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Membership = require("../models/Membership");
const MembershipPlan = require("../models/MembershipPlan");
const Booking = require("../models/Booking");
const MeetingType = require("../models/MeetingType");
const Gift = require("../models/Gift");
const GiftTransaction = require("../models/GiftTransaction");
const { markManualPaymentSuccessful } = require("../services/manualPaymentService");

const token = () => `PAY-${new Date().toISOString().slice(0,10).replace(/-/g, "")}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
const reference = token;
const tierOrder = ["FAN", "SUPPORTER", "INSIDER", "VIP"];

const getSupportAdmin = async () => User.findOne({ role: "ADMIN", isPaymentSupport: true, isActive: true }).select("name username email profileImage");

const requestPayment = async (req, res) => {
  try {
    const { type, itemId, scheduledFor, quantity, message, notes } = req.body;
    if (!["MEMBERSHIP", "MEETING", "GIFT"].includes(type) || !itemId) return res.status(400).json({ success: false, message: "A valid payment type and item are required." });
    const supportAdmin = await getSupportAdmin();
    if (!supportAdmin) return res.status(503).json({ success: false, message: "Payment support is currently unavailable. Please try again later." });

    let amount; let currency = "USD"; let membership = null; let booking = null; let giftTransaction = null; let description = "";

    if (type === "MEMBERSHIP") {
      const plan = await MembershipPlan.findOne({ _id: itemId, isActive: true });
      if (!plan) return res.status(404).json({ success: false, message: "Membership plan not found." });
      const existing = await Membership.findOne({ user: req.user._id, status: "ACTIVE", expiresAt: { $gt: new Date() } });
      if (existing) return res.status(409).json({ success: false, message: "You already have an active membership." });
      amount = plan.price; currency = plan.currency || "USD"; description = `${plan.name} membership`;
      membership = await Membership.create({ user: req.user._id, plan: plan._id, status: "PENDING" });
    }

    if (type === "MEETING") {
      const meetingType = await MeetingType.findOne({ _id: itemId, isActive: true });
      if (!meetingType) return res.status(404).json({ success: false, message: "Meeting type not found." });
      const slot = new Date(scheduledFor);
      if (!scheduledFor || Number.isNaN(slot.getTime()) || slot.getTime() < Date.now()) return res.status(400).json({ success: false, message: "A valid future meeting date/time is required." });
      const activeMembership = await Membership.findOne({ user: req.user._id, status: "ACTIVE", expiresAt: { $gt: new Date() } }).populate("plan", "minimumMeetingTier");
      if (!activeMembership) return res.status(403).json({ success: false, message: "An active membership is required to book a meeting." });
      const requiredTier = meetingType.minimumMembershipTier;
      if (tierOrder.indexOf(activeMembership.plan.minimumMeetingTier) < tierOrder.indexOf(requiredTier)) return res.status(403).json({ success: false, message: `The ${meetingType.name} requires at least a ${requiredTier} membership.` });
      if (await Booking.findOne({ scheduledFor: slot, status: { $in: ["PENDING_PAYMENT", "CONFIRMED", "COMPLETED"] } })) return res.status(409).json({ success: false, message: "That time slot is no longer available. Please choose another." });
      amount = meetingType.price; currency = meetingType.currency || "USD"; description = `${meetingType.name} meeting`;
      booking = await Booking.create({ user: req.user._id, meetingType: meetingType._id, reference: `BK-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`, scheduledFor: slot, notes: notes || "", status: "PENDING_PAYMENT" });
    }

    if (type === "GIFT") {
      const gift = await Gift.findOne({ _id: itemId, isActive: true });
      if (!gift) return res.status(404).json({ success: false, message: "Gift not found." });
      const qty = Number.isInteger(Number(quantity)) && Number(quantity) > 0 ? Math.min(Number(quantity), 100) : 1;
      amount = gift.price * qty; currency = gift.currency || "USD"; description = `${gift.name}${qty > 1 ? ` x${qty}` : ""}`;
      const giftReference = `GFT-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      giftTransaction = await GiftTransaction.create({ user: req.user._id, gift: gift._id, reference: giftReference, amount, quantity: qty, message: message || "", status: "PENDING_PAYMENT" });
    }

    const paymentToken = token();
    const payment = await Payment.create({ user: req.user._id, type, membership: membership?._id || null, booking: booking?._id || null, giftTransaction: giftTransaction?._id || null, reference: paymentToken, paymentToken, supportAdmin: supportAdmin._id, originalAmount: amount, originalCurrency: currency, amount, currency, exchangeRate: 1, provider: "INTERNAL", status: "PENDING", metadata: { description } });
    if (booking) { booking.payment = payment._id; await booking.save(); }
    if (giftTransaction) { giftTransaction.payment = payment._id; await giftTransaction.save(); }

    return res.status(201).json({ success: true, message: "Payment request created. Contact the designated payment support and provide your payment token.", payment: { id: payment._id, token: payment.paymentToken, reference: payment.reference, type: payment.type, amount: payment.originalAmount, currency: payment.originalCurrency, status: payment.status, createdAt: payment.createdAt }, support: supportAdmin });
  } catch (error) {
    console.error("Manual payment request error:", error);
    return res.status(500).json({ success: false, message: error.message || "Unable to create payment request." });
  }
};

const getMyPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({ user: req.user._id, $or: [{ paymentToken: req.params.token }, { reference: req.params.token }] }).populate("supportAdmin", "name username email profileImage");
    if (!payment) return res.status(404).json({ success: false, message: "Payment request not found." });
    return res.json({ success: true, payment });
  } catch (error) { return res.status(500).json({ success: false, message: "Unable to retrieve payment request." }); }
};

const getPaymentSupport = async (req, res) => {
  const support = await getSupportAdmin();
  if (!support) return res.status(404).json({ success: false, message: "Payment support is not currently available." });
  return res.json({ success: true, support });
};

const confirmPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: "Payment request not found." });
    if (!payment.supportAdmin.equals(req.user._id)) return res.status(403).json({ success: false, message: "Only the designated payment support administrator can confirm this payment." });
    const result = await markManualPaymentSuccessful({ paymentId: payment._id, adminId: req.user._id, adminNote: req.body.adminNote || "" });
    return res.json({ success: true, message: "Payment confirmed successfully. The member has been notified.", ...result });
  } catch (error) { console.error("Confirm manual payment error:", error); return res.status(400).json({ success: false, message: error.message || "Unable to confirm payment." }); }
};

const listPendingPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ supportAdmin: req.user._id, status: "PENDING" }).populate("user", "name username email").sort({ createdAt: 1 });
    return res.json({ success: true, payments });
  } catch (error) { return res.status(500).json({ success: false, message: "Unable to retrieve pending payments." }); }
};

const setPaymentSupport = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "ADMIN") return res.status(404).json({ success: false, message: "Administrator not found." });
    await User.updateMany({ role: "ADMIN", isPaymentSupport: true }, { $set: { isPaymentSupport: false } });
    user.isPaymentSupport = true; await user.save();
    return res.json({ success: true, message: `${user.name} is now the designated payment support administrator.`, user: user.toObject({ transform: (_, obj) => { delete obj.password; return obj; } }) });
  } catch (error) { return res.status(500).json({ success: false, message: "Unable to designate payment support." }); }
};

module.exports = { requestPayment, getMyPayment, getPaymentSupport, confirmPayment, listPendingPayments, setPaymentSupport };
