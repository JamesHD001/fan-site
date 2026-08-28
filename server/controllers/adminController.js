const mongoose = require("mongoose");
const User = require("../models/User");
const Membership = require("../models/Membership");
const Booking = require("../models/Booking");
const GiftTransaction = require("../models/GiftTransaction");
const Post = require("../models/Post");
const Payment = require("../models/Payment");

const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeMemberships,
      pendingBookings,
      confirmedBookings,
      completedGifts,
      pendingPosts,
      paymentAggregation,
    ] = await Promise.all([
      User.countDocuments(),
      Membership.countDocuments({ status: "ACTIVE", expiresAt: { $gt: new Date() } }),
      Booking.countDocuments({ status: "PENDING_PAYMENT" }),
      Booking.countDocuments({ status: "CONFIRMED" }),
      GiftTransaction.countDocuments({ status: "COMPLETED" }),
      Post.countDocuments({ status: "PENDING" }),
      Payment.aggregate([
        { $match: { status: "SUCCESS" } },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const revenueByType = {
      MEMBERSHIP: { total: 0, count: 0 },
      MEETING: { total: 0, count: 0 },
      GIFT: { total: 0, count: 0 },
      DEPOSIT: { total: 0, count: 0 },
    };

    let totalRevenue = 0;
    let totalTransactions = 0;

    for (const entry of paymentAggregation) {
      if (revenueByType[entry._id]) {
        revenueByType[entry._id] = {
          total: Math.round(entry.total * 100) / 100,
          count: entry.count,
        };
      }
      totalRevenue += entry.total;
      totalTransactions += entry.count;
    }

    return res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeMemberships,
          bookings: {
            pendingPayment: pendingBookings,
            confirmed: confirmedBookings,
          },
          giftsCompleted: completedGifts,
          postsPendingApproval: pendingPosts,
        },
        revenue: {
          currency: "NGN",
          total: Math.round(totalRevenue * 100) / 100,
          transactions: totalTransactions,
          byType: revenueByType,
        },
      },
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve dashboard statistics.",
    });
  }
};

const getUsers = async (req, res) => {
  try {
    // Returns ALL users — registered, unverified, disabled and test accounts
    // alike. No status filter is applied by default.
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
      User.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve users." });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, data: user });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update user." });
  }
};

const setUserActiveStatus = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: Boolean(req.body.isActive) },
      { new: true }
    ).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, data: user });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update user status." });
  }
};

const getPayments = async (req, res) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    const payments = await Payment.find(query).populate("user", "name email").sort({ createdAt: -1 });
    return res.json({ success: true, data: payments });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve payments." });
  }
};

const getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().populate("user", "name email").sort({ createdAt: -1 });
    return res.json({ success: true, data: bookings });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve bookings." });
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    return res.json({ success: true, data: booking });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update booking status." });
  }
};

const getGiftTransactions = async (req, res) => {
  try {
    const transactions = await GiftTransaction.find().populate("user", "name email").sort({ createdAt: -1 });
    return res.json({ success: true, data: transactions });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve gift transactions." });
  }
};

const updateGiftStatus = async (req, res) => {
  try {
    const transaction = await GiftTransaction.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!transaction) return res.status(404).json({ success: false, message: "Gift transaction not found." });
    return res.json({ success: true, data: transaction });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update gift status." });
  }
};

const getGiftsAdmin = async (req, res) => {
  try {
    const Gift = require("../models/Gift");
    const gifts = await Gift.find().sort({ createdAt: -1 });
    return res.json({ success: true, data: gifts });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve gifts." });
  }
};

const updateGift = async (req, res) => {
  try {
    const Gift = require("../models/Gift");
    const gift = await Gift.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!gift) return res.status(404).json({ success: false, message: "Gift not found." });
    return res.json({ success: true, data: gift });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update gift." });
  }
};

const getMembershipPlansAdmin = async (req, res) => {
  try {
    const MembershipPlan = require("../models/MembershipPlan");
    const plans = await MembershipPlan.find().sort({ createdAt: -1 });
    return res.json({ success: true, data: plans });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve membership plans." });
  }
};

const updateMembershipPlan = async (req, res) => {
  try {
    const MembershipPlan = require("../models/MembershipPlan");
    const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: "Membership plan not found." });
    return res.json({ success: true, data: plan });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update membership plan." });
  }
};

const getMeetingTypesAdmin = async (req, res) => {
  try {
    const MeetingType = require("../models/MeetingType");
    const meetings = await MeetingType.find().sort({ createdAt: -1 });
    return res.json({ success: true, data: meetings });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve meeting types." });
  }
};

const updateMeetingType = async (req, res) => {
  try {
    const MeetingType = require("../models/MeetingType");
    const meeting = await MeetingType.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!meeting) return res.status(404).json({ success: false, message: "Meeting type not found." });
    return res.json({ success: true, data: meeting });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to update meeting type." });
  }
};

const getPendingPosts = async (req, res) => {
  try {
    const posts = await Post.find({ status: "PENDING" }).populate("user", "name email").sort({ createdAt: -1 });
    return res.json({ success: true, data: posts });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to retrieve pending posts." });
  }
};

const moderatePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });
    return res.json({ success: true, data: post });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to moderate post." });
  }
};

const sendAnnouncement = async (req, res) => {
  try {
    return res.status(501).json({ success: false, message: "Announcement delivery is not configured yet." });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Unable to send announcement." });
  }
};

const resolvePaymentReview = async (req, res) => {
  try {
    const { resolution } = req.body;
    if (!['CREDIT_AS_PAID', 'VOID'].includes(resolution)) {
      return res.status(400).json({ success: false, message: "Resolution must be CREDIT_AS_PAID or VOID." });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found." });
    if (payment.status !== "REQUIRES_REVIEW") {
      return res.status(400).json({ success: false, message: `Payment is ${payment.status}, not awaiting review.` });
    }

    if (resolution === "VOID") {
      payment.status = "REFUNDED";
      payment.metadata = { ...payment.metadata, reviewResolvedAt: new Date().toISOString(), reviewResolvedBy: req.user._id.toString(), reviewResolution: "VOID" };
      await payment.save();
      return res.json({ success: true, data: payment });
    }

    // CREDIT_AS_PAID: honor the customer's payment despite the mismatch.
    if (payment.type === "DEPOSIT") {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const { creditWallet } = require("../services/walletService");
        await creditWallet({
          userId: payment.user,
          amount: payment.originalAmount,
          type: "DEPOSIT",
          reference: `WAL-${payment.reference}`,
          paymentId: payment._id,
          description: "Wallet funding deposit (approved after review)",
          session,
        });
        payment.status = "SUCCESS";
        payment.paidAt = new Date();
        payment.metadata = { ...payment.metadata, reviewResolvedAt: new Date().toISOString(), reviewResolvedBy: req.user._id.toString(), reviewResolution: "CREDIT_AS_PAID" };
        await payment.save({ session });
        await session.commitTransaction();
      } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    } else {
      // Non-deposit types (membership/meeting/gift) require domain-side
      // activation which settlement owns; surface this to the admin instead
      // of silently mis-activating.
      return res.status(400).json({ success: false, message: `CREDIT_AS_PAID is only supported for DEPOSIT payments. This payment is ${payment.type}.` });
    }

    return res.json({ success: true, data: payment });
  } catch (e) {
    console.error("Resolve payment review error:", e);
    return res.status(500).json({ success: false, message: "Unable to resolve payment review." });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  updateUser,
  setUserActiveStatus,
  getPayments,
  getBookings,
  updateBookingStatus,
  getGiftTransactions,
  updateGiftStatus,
  getGiftsAdmin,
  updateGift,
  getMembershipPlansAdmin,
  updateMembershipPlan,
  getMeetingTypesAdmin,
  updateMeetingType,
  getPendingPosts,
  moderatePost,
  sendAnnouncement,
  resolvePaymentReview,
};
