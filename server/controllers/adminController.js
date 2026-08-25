const User = require("../models/User");
const Membership = require("../models/Membership");
const Booking = require("../models/Booking");
const GiftTransaction = require("../models/GiftTransaction");
const Payment = require("../models/Payment");
const Post = require("../models/Post");

const { createNotification } = require("../services/notificationService");

/*
 * Dashboard overview: aggregate counts and revenue.
 */
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
      Membership.countDocuments({
        status: "ACTIVE",
        expiresAt: { $gt: new Date() },
      }),
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

    // Build revenue summary per payment type (NGN)
    const revenueByType = {
      MEMBERSHIP: { total: 0, count: 0 },
      MEETING: { total: 0, count: 0 },
      GIFT: { total: 0, count: 0 },
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

    return res.status(200).json({
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
          total:
            Math.round(totalRevenue * 100) / 100,
          transactions: totalTransactions,
          byType: revenueByType,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve dashboard statistics.",
    });
  }
};

/*
 * Users list with search + pagination.
 */
const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      50,
      parseInt(req.query.limit) || 20
    );
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.search) {
      const regex = new RegExp(
        req.query.search.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        ),
        "i"
      );

      query.$or = [
        { name: regex },
        { username: regex },
        { email: regex },
      ];
    }

    if (req.query.role) {
      query.role = req.query.role;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve users.",
    });
  }
};

/*
 * Enable/disable a user account.
 */
const setUserActiveStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message:
          "isActive boolean value is required.",
      });
    }

    if (
      req.params.id === req.user._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot change the status of your own account.",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `User ${isActive ? "enabled" : "disabled"
        } successfully.`,
      data: { user },
    });
  } catch (error) {
    console.error(
      "Set user status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to update user status.",
    });
  }
};

/*
 * Payments list with filters.
 */
const getPayments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      50,
      parseInt(req.query.limit) || 20
    );
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.type) {
      query.type = req.query.type;
    }

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate("user", "name username email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve payments.",
    });
  }
};

const getBookings = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      50,
      parseInt(req.query.limit) || 20
    );
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate("user", "name username email")
        .populate(
          "meetingType",
          "name duration price currency"
        )
        .sort({ scheduledFor: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve bookings.",
    });
  }
};

/*
 * Admin confirms or declines a paid booking.
 */
const updateBookingStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;

    if (
      !["CONFIRMED", "DECLINED", "COMPLETED"].includes(
        status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Status must be CONFIRMED, DECLINED or COMPLETED.",
      });
    }

    const booking = await Booking.findById(
      req.params.id
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    booking.status = status;

    if (adminNotes !== undefined) {
      booking.adminNotes = adminNotes;
    }

    if (status === "CONFIRMED") {
      booking.confirmedAt = new Date();
    }

    if (status === "COMPLETED") {
      booking.completedAt = new Date();
    }

    await booking.save();

    // Notify the user about the status change
    await createNotification({
      userId: booking.user.toString(),
      type: "BOOKING",
      title: `Meeting booking ${status.toLowerCase()}`,
      message: `Your meeting (${booking.reference}) has been ${status.toLowerCase()} by the team.`,
      link: "/meetings/bookings",
    });

    return res.status(200).json({
      success: true,
      message: `Booking ${status.toLowerCase()} successfully.`,
      data: { booking },
    });
  } catch (error) {
    console.error(
      "Update booking status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update booking status.",
    });
  }
};

/*
 * Post moderation queue.
 */
const getPendingPosts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      50,
      parseInt(req.query.limit) || 20
    );
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ status: "PENDING" })
        .populate("author", "name username email")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments({ status: "PENDING" }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        posts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get pending posts error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve pending posts.",
    });
  }
};

/*
 * Approve / reject / remove a post.
 */
const moderatePost = async (req, res) => {
  try {
    const { status } = req.body;

    if (
      !["APPROVED", "REJECTED", "REMOVED"].includes(
        status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Status must be APPROVED, REJECTED or REMOVED.",
      });
    }

    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("author", "name username");

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    if (status === "APPROVED") {
      await createNotification({
        userId: post.author._id.toString(),
        type: "POST",
        title: "Post approved",
        message:
          "Your post has been approved and is now visible in the community.",
        link: "/community",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Post ${status.toLowerCase()} successfully.`,
      data: { post },
    });
  } catch (error) {
    console.error("Moderate post error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to moderate post.",
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  setUserActiveStatus,
  getPayments,
  getBookings,
  updateBookingStatus,
  getPendingPosts,
  moderatePost,
};
