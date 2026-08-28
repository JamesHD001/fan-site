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

    const revenueByType = {
      MEMBERSHIP: { total: 0, count: 0 },
      MEETING: { total: 0, count: 0 },
      GIFT: { total: 0, count: 0 }
    };
    let totalRevenue = 0;
    let totalTransactions = 0;

    for (const entry of paymentAggregation) {
      if (revenueByType[entry._id]) revenueByType[entry._id] = { total: entry.total, count: entry.count };
      totalRevenue += entry.total;
      totalTransactions += entry.count;
    }

    return res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeMemberships,
          bookings: { pendingPayment: pendingBookings, confirmed: confirmedBookings },
          giftsCompleted: completedGifts,
          postsPendingApproval: pendingPosts
        },
        revenue: {
          currency: "USD",
          total: totalRevenue,
          transactions: totalTransactions,
          byType: revenueByType
        }
      }
    });
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
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, data: user });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update user." });
  }
};

const setUserActiveStatus = async (req, res) => {
  try {
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

    if (req.params.id === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "You cannot delete your own administrator account." });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.role === "ADMIN") {
      return res.status(400).json({ success: false, message: "Administrator accounts cannot be deleted. Disable the account instead." });
    }

    // Delete all user-owned records first. Posts and comments use `author`, not `user`.
    // These operations intentionally do not require a MongoDB transaction so deletion
    // also works with local MongoDB instances that are not configured as replica sets.
    await Membership.deleteMany({ user: user._id });
    await Booking.deleteMany({ user: user._id });
    await GiftTransaction.deleteMany({ user: user._id });
    await Payment.deleteMany({ user: user._id });
    await Post.deleteMany({ author: user._id });
    await Comment.deleteMany({ author: user._id });
    await Like.deleteMany({ user: user._id });
    await Notification.deleteMany({ user: user._id });
    await OtpVerification.deleteMany({ user: user._id });

    const deletedUser = await User.findByIdAndDelete(user._id);
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: "User was not found during deletion." });
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
    const payments = await Payment.find(query).populate("user", "name email username").populate("supportAdmin", "name email username").sort({ createdAt: -1 });
    return res.json({ success: true, data: { payments } });
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

const getGiftsAdmin = async (req, res) => {
  try {
    const Gift = require("../models/Gift");
    return res.json({ success: true, data: { gifts: await Gift.find().sort({ createdAt: -1 }) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve gifts." });
  }
};

const updateGift = async (req, res) => {
  try {
    const Gift = require("../models/Gift");
    const gift = await Gift.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!gift) return res.status(404).json({ success: false, message: "Gift not found." });
    return res.json({ success: true, data: { gift } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update gift." });
  }
};

const getMembershipPlansAdmin = async (req, res) => {
  try {
    const MembershipPlan = require("../models/MembershipPlan");
    return res.json({ success: true, data: { plans: await MembershipPlan.find().sort({ createdAt: -1 }) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve membership plans." });
  }
};

const updateMembershipPlan = async (req, res) => {
  try {
    const MembershipPlan = require("../models/MembershipPlan");
    const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: "Membership plan not found." });
    return res.json({ success: true, data: { plan } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update membership plan." });
  }
};

const getMeetingTypesAdmin = async (req, res) => {
  try {
    const MeetingType = require("../models/MeetingType");
    return res.json({ success: true, data: { meetings: await MeetingType.find().sort({ createdAt: -1 }) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve meeting types." });
  }
};

const updateMeetingType = async (req, res) => {
  try {
    const MeetingType = require("../models/MeetingType");
    const meeting = await MeetingType.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!meeting) return res.status(404).json({ success: false, message: "Meeting type not found." });
    return res.json({ success: true, data: { meeting } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update meeting type." });
  }
};

const getPendingPosts = async (req, res) => {
  try {
    return res.json({ success: true, data: { posts: await Post.find({ status: "PENDING" }).populate("user", "name email").sort({ createdAt: -1 }) } });
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
