const Comment = require("../models/Comment");
const Post = require("../models/Post");

const getCommentsForPost = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      50,
      parseInt(req.query.limit) || 20
    );
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      Comment.find({ post: req.params.postId, status: "APPROVED" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name username profileImage"),
      Comment.countDocuments({
        post: req.params.postId,
        status: "APPROVED",
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        comments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get comments error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve comments.",
    });
  }
};

const createComment = async (req, res) => {
  try {
    const { content } = req.body;

    if (
      !content ||
      typeof content !== "string" ||
      !content.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required.",
      });
    }

    const post = await Post.findOne({
      _id: req.params.postId,
      status: "APPROVED",
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      content,
    });

    await comment.populate(
      "author",
      "name username profileImage"
    );

    return res.status(201).json({
      success: true,
      message: "Comment added successfully.",
      data: { comment },
    });
  } catch (error) {
    console.error("Create comment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to add comment.",
    });
  }
};

const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    const isOwner =
      comment.author.toString() ===
      req.user._id.toString();
    const isAdmin = req.user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to delete this comment.",
      });
    }

    await comment.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully.",
    });
  } catch (error) {
    console.error("Delete comment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete comment.",
    });
  }
};

module.exports = {
  getCommentsForPost,
  createComment,
  deleteComment,
};
