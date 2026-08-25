const Like = require("../models/Like");
const Post = require("../models/Post");

/*
 * Toggle like on a post for the current user.
 */
const toggleLike = async (req, res) => {
  try {
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

    const existingLike = await Like.findOne({
      user: req.user._id,
      post: post._id,
    });

    if (existingLike) {
      await existingLike.deleteOne();

      const likeCount = await Like.countDocuments({
        post: post._id,
      });

      return res.status(200).json({
        success: true,
        message: "Post unliked.",
        data: { liked: false, likeCount },
      });
    }

    await Like.create({
      user: req.user._id,
      post: post._id,
    });

    const likeCount = await Like.countDocuments({
      post: post._id,
    });

    return res.status(200).json({
      success: true,
      message: "Post liked.",
      data: { liked: true, likeCount },
    });
  } catch (error) {
    console.error("Toggle like error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process like.",
    });
  }
};

module.exports = { toggleLike };
