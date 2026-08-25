const Notification = require("../models/Notification");

/*
 * Authenticated: list the current user's notifications.
 */
const getMyNotifications = async (req, res) => {
  try {
    const page = Math.max(
      1,
      parseInt(req.query.page) || 1
    );
    const limit = Math.min(
      50,
      parseInt(req.query.limit) || 20
    );
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };

    // Optional filter: ?unread=true
    if (req.query.unread === "true") {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] =
      await Promise.all([
        Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Notification.countDocuments(query),
        Notification.countDocuments({
          user: req.user._id,
          isRead: false,
        }),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error(
      "Get notifications error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve notifications.",
    });
  }
};

/*
 * Authenticated: mark a single notification as read.
 */
const markAsRead = async (req, res) => {
  try {
    const notification =
      await Notification.findOne({
        _id: req.params.id,
        user: req.user._id,
      });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: { notification },
    });
  } catch (error) {
    console.error("Mark as read error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to mark notification as read.",
    });
  }
};

/*
 * Authenticated: mark all of the user's
 * notifications as read.
 */
const markAllAsRead = async (req, res) => {
  try {
    const result =
      await Notification.updateMany(
        {
          user: req.user._id,
          isRead: false,
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        }
      );

    return res.status(200).json({
      success: true,
      message:
        "All notifications marked as read.",
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error(
      "Mark all as read error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to mark notifications as read.",
    });
  }
};

/*
 * Authenticated: delete a notification.
 */
const deleteNotification = async (req, res) => {
  try {
    const result =
      await Notification.deleteOne({
        _id: req.params.id,
        user: req.user._id,
      });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Notification deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete notification error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete notification.",
    });
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
