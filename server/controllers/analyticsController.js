const User = require("../models/User");
const Membership = require("../models/Membership");
const Booking = require("../models/Booking");
const GiftTransaction = require("../models/GiftTransaction");
const Payment = require("../models/Payment");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Like = require("../models/Like");

/*
 * Shared helper: builds a { user, createdAt } match
 * window for the last N days.
 */
const daysAgo = (n) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/*
 * GET /api/analytics/overview
 * High-level KPIs for the dashboard.
 */
const getOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      newUsers30d,
      activeMemberships,
      confirmedBookings,
      completedGifts,
      approvedPosts,
      revenueAgg,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({
        createdAt: { $gte: daysAgo(30) },
      }),
      Membership.countDocuments({
        status: "ACTIVE",
        expiresAt: { $gt: new Date() },
      }),
      Booking.countDocuments({ status: "CONFIRMED" }),
      GiftTransaction.countDocuments({
        status: "COMPLETED",
      }),
      Post.countDocuments({ status: "APPROVED" }),
      Payment.aggregate([
        { $match: { status: "SUCCESS" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const revenue =
      revenueAgg.length > 0
        ? Math.round(revenueAgg[0].total * 100) / 100
        : 0;
    const transactions =
      revenueAgg.length > 0 ? revenueAgg[0].count : 0;

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          currency: "NGN",
          totalRevenue: revenue,
          totalTransactions: transactions,
          totalUsers,
          newUsersLast30Days: newUsers30d,
          activeMemberships,
          confirmedBookings,
          completedGifts,
          approvedPosts,
        },
      },
    });
  } catch (error) {
    console.error("Analytics overview error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve analytics overview.",
    });
  }
};

/*
 * GET /api/analytics/revenue?days=30
 * Daily revenue trend (default last 30 days).
 */
const getRevenueTrend = async (req, res) => {
  try {
    const days = Math.min(
      365,
      Math.max(1, parseInt(req.query.days) || 30)
    );

    const since = daysAgo(days);

    const trend = await Payment.aggregate([
      {
        $match: {
          status: "SUCCESS",
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
            },
          },
          revenue: {
            $round: ["$revenue", 2],
          },
          count: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);

    // Revenue split by payment type over the window
    const byType = await Payment.aggregate([
      {
        $match: {
          status: "SUCCESS",
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: "$type",
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          type: "$_id",
          revenue: { $round: ["$revenue", 2] },
          count: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        period: { days, since },
        currency: "NGN",
        trend,
        byType,
      },
    });
  } catch (error) {
    console.error("Revenue trend error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve revenue analytics.",
    });
  }
};

/*
 * GET /api/analytics/users?months=6
 * Monthly new-user growth (default last 6 months).
 */
const getUserGrowth = async (req, res) => {
  try {
    const months = Math.min(
      24,
      Math.max(1, parseInt(req.query.months) || 6)
    );

    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const growth = await User.aggregate([
      {
        $match: { createdAt: { $gte: since } },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          month: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: 1,
            },
          },
          count: 1,
        },
      },
      { $sort: { month: 1 } },
    ]);

    const roleBreakdown = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          role: "$_id",
          count: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        period: { months, since },
        growth,
        roleBreakdown,
      },
    });
  } catch (error) {
    console.error("User growth error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve user analytics.",
    });
  }
};

/*
 * GET /api/analytics/content
 * Community engagement stats.
 */
const getContentStats = async (req, res) => {
  try {
    const [
      postsByStatus,
      topPosts,
      commentAgg,
    ] = await Promise.all([
      Post.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            status: "$_id",
            count: 1,
          },
        },
      ]),
      Post.find({ status: "APPROVED" })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("title author status createdAt"),
      Comment.aggregate([
        {
          $group: {
            _id: "$post",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "posts",
            localField: "_id",
            foreignField: "_id",
            as: "post",
          },
        },
        { $unwind: "$post" },
        {
          $project: {
            _id: 0,
            postId: "$_id",
            title: "$post.title",
            commentCount: "$count",
          },
        },
      ]),
    ]);

    // Like counts for the top-commented posts
    const postIds = commentAgg.map(
      (c) => c.postId
    );

    const likeCounts = await Like.aggregate([
      { $match: { post: { $in: postIds } } },
      {
        $group: {
          _id: "$post",
          count: { $sum: 1 },
        },
      },
    ]);

    const likeMap = new Map(
      likeCounts.map((l) => [
        String(l._id),
        l.count,
      ])
    );

    const mostDiscussed = commentAgg.map((c) => ({
      ...c,
      likeCount: likeMap.get(String(c.postId)) || 0,
    }));

    return res.status(200).json({
      success: true,
      data: {
        content: {
          postsByStatus,
          recentPosts: topPosts,
          mostDiscussed,
        },
      },
    });
  } catch (error) {
    console.error("Content stats error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve content analytics.",
    });
  }
};

module.exports = {
  getOverview,
  getRevenueTrend,
  getUserGrowth,
  getContentStats,
};
