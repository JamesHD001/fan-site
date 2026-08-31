const User = require("../models/User");
const Membership = require("../models/Membership");
const Booking = require("../models/Booking");
const GiftTransaction = require("../models/GiftTransaction");
const Post = require("../models/Post");
const Payment = require("../models/Payment");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const Notification = require("../models/Notification");
const OtpVerification = require("../models/OtpVerification");
const mongoose = require("mongoose");

const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, activeMemberships, pendingBookings, confirmedBookings, completedGifts, pendingPosts, paymentAggregation] = await Promise.all([
      User.countDocuments(),
      Membership.countDocuments({ status: "ACTIVE", expiresAt: { $gt: new Date() } }),
      Booking.countDocuments({ status: "PENDING_PAYMENT" }),
      Booking.countDocuments({ status: "CONFIRMED" }),
      GiftTransaction.countDocuments({ status: "COMPLETED" }),
      Post.countDocuments({ status: "PENDING" }),
      Payment.aggregate([
        { $match: { status: "SUCCESS" } },
        { $group: { _id: "$type", total: { $sum: "$originalAmount" }, count: { $sum: 1 } } }
      ])
    ]);
    const revenueByType = { MEMBERSHIP: { total: 0, count: 0 }, MEETING: { total: 0, count: 0 }, GIFT: { total: 0, count: 0 } };
    let totalRevenue = 0;
    let totalTransactions = 0;
    for (const entry of paymentAggregation) {
      if (revenueByType[entry._id]) revenueByType[entry._id] = { total: entry.total, count: entry.count };
      totalRevenue += entry.total;
      totalTransactions += entry.count;
    }
    return res.json({ success: true, data: { stats: { totalUsers, activeMemberships, bookings: { pendingPayment: pendingBookings, confirmed: confirmedBookings }, giftsCompleted: completedGifts, postsPendingApproval: pendingPosts }, revenue: { currency: "USD", total: totalRevenue, transactions: totalTransactions, byType: revenueByType } } });
  } catch (e) {
    console.error("Admin dashboard stats error:", e);
    return res.status(500).json({ success: false, message: "Unable to retrieve dashboard statistics." });
  }
};

const getUsers = async (req, res) => {
  try {
    const query = {};
    const search = String(req.query.search || "").trim();
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ name: rx }, { username: rx }, { email: rx }];
    }
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const [users, total] = await Promise.all([
      User.find(query).select("-password").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(query)
    ]);
    return res.json({ success: true, data: { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve users." });
  }
};

const updateUser = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id) && req.body.role && req.body.role !== "ADMIN") {
      return res.status(400).json({ success: false, message: "You cannot remove administrator privileges from your own account." });
    }
    const allowedFields = ["name", "username", "email", "role", "isActive", "profileImage"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, data: user });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update user." });
  }
};

const setUserActiveStatus = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "You cannot disable your own administrator account." });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: Boolean(req.body.isActive) }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, data: user });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update user status." });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user id." });
    }

    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "You cannot delete your own administrator account." });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    // Other administrator accounts, including test/admin accounts, may be deleted.
    // The currently authenticated administrator is the only protected account here.
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Membership.deleteMany({ user: user._id }, { session });
        await Booking.deleteMany({ user: user._id }, { session });
        await GiftTransaction.deleteMany({ user: user._id }, { session });
        await Payment.deleteMany({ user: user._id }, { session });
        await Post.deleteMany({ author: user._id }, { session });
        await Comment.deleteMany({ author: user._id }, { session });
        await Like.deleteMany({ user: user._id }, { session });
        await Notification.deleteMany({ user: user._id }, { session });
        await OtpVerification.deleteMany({ user: user._id }, { session });

        const deletedUser = await User.findByIdAndDelete(user._id, { session });
        if (!deletedUser) {
          throw new Error("User was not found during deletion.");
        }
      });
    } finally {
      await session.endSession();
    }

    return res.json({
      success: true,
      message: `User ${user.email} and all associated data were deleted permanently.`
    });
  } catch (e) {
    console.error("Admin delete user error:", e);
    return res.status(500).json({ success: false, message: "Unable to delete user." });
  }
};

const getPayments = async (req, res) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const [payments, total] = await Promise.all([
      Payment.find(query).populate("user", "name email username").populate("supportAdmin", "name email username").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Payment.countDocuments(query)
    ]);
    return res.json({ success: true, data: { payments, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve payments." });
  }
};

const getBookings = async (req, res) => {
  try {
    return res.json({ success: true, data: { bookings: await Booking.find().populate("user", "name email").populate("meetingType", "name price currency").sort({ createdAt: -1 }) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve bookings." });
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    return res.json({ success: true, data: { booking } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update booking status." });
  }
};

const getGiftTransactions = async (req, res) => {
  try {
    return res.json({ success: true, data: { transactions: await GiftTransaction.find().populate("user", "name email").populate("gift", "name price currency image").sort({ createdAt: -1 }) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve gift transactions." });
  }
};

const updateGiftStatus = async (req, res) => {
  try {
    const transaction = await GiftTransaction.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!transaction) return res.status(404).json({ success: false, message: "Gift transaction not found." });
    return res.json({ success: true, data: { transaction } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update gift status." });
  }
};

const createCrudHandlers = ({ modelPath, label, listKey }) => {
  const getItems = async (req, res) => {
    try {
      const Model = require(modelPath);
      const items = await Model.find().sort({ createdAt: -1 });
      return res.json({ success: true, data: { [listKey]: items } });
    } catch (e) {
      return res.status(500).json({ success: false, message: `Unable to retrieve ${label}s.` });
    }
  };

  const updateItem = async (req, res) => {
    try {
      const Model = require(modelPath);
      const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!item) return res.status(404).json({ success: false, message: `${label} not found.` });
      return res.json({ success: true, data: { [listKey.slice(0, -1)]: item } });
    } catch (e) {
      return res.status(500).json({ success: false, message: `Unable to update ${label}.` });
    }
  };

  return { getItems, updateItem };
};

const giftHandlers = createCrudHandlers({ modelPath: "../models/Gift", label: "Gift", listKey: "gifts" });
const getGiftsAdmin = giftHandlers.getItems;
const updateGift = giftHandlers.updateItem;

const membershipPlanHandlers = createCrudHandlers({ modelPath: "../models/MembershipPlan", label: "Membership plan", listKey: "plans" });
const getMembershipPlansAdmin = membershipPlanHandlers.getItems;
const updateMembershipPlan = membershipPlanHandlers.updateItem;

const meetingTypeHandlers = createCrudHandlers({ modelPath: "../models/MeetingType", label: "Meeting type", listKey: "meetings" });
const getMeetingTypesAdmin = meetingTypeHandlers.getItems;
const updateMeetingType = meetingTypeHandlers.updateItem;

const getPendingPosts = async (req, res) => {
  try {
    return res.json({ success: true, data: { posts: await Post.find({ status: "PENDING" }).populate("author", "name email username").sort({ createdAt: -1 }) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve pending posts." });
  }
};

const moderatePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });
    return res.json({ success: true, data: { post } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to moderate post." });
  }
};

const sendAnnouncement = async (req, res) => res.status(501).json({ success: false, message: "Announcement delivery is not configured yet." });

module.exports = { getDashboardStats, getUsers, updateUser, setUserActiveStatus, deleteUser, getPayments, getBookings, updateBookingStatus, getGiftTransactions, updateGiftStatus, getGiftsAdmin, updateGift, getMembershipPlansAdmin, updateMembershipPlan, getMeetingTypesAdmin, updateMeetingType, getPendingPosts, moderatePost, sendAnnouncement };
