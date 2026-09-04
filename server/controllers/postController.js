const Post = require("../models/Post");
const Like = require("../models/Like");
const Comment = require("../models/Comment");
const { uploadPostImage } = require("../services/cloudinaryService");

const getPosts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;
    const query = { status: "APPROVED" };
    if (req.user) query.$or = [{ status: "APPROVED" }, { author: req.user._id }];

    const [posts, total] = await Promise.all([
      Post.find(query).sort({ isPinned: -1, createdAt: -1 }).skip(skip).limit(limit)
        .populate("author", "name username profileImage")
        .populate("celebrity", "name slug profileImage"),
      Post.countDocuments(query),
    ]);
    const postIds = posts.map((p) => p._id);
    const [likeCounts, commentCounts, likedByMe] = await Promise.all([
      Like.aggregate([{ $match: { post: { $in: postIds } } }, { $group: { _id: "$post", count: { $sum: 1 } } }]),
      Comment.aggregate([{ $match: { post: { $in: postIds }, status: "APPROVED" } }, { $group: { _id: "$post", count: { $sum: 1 } } }]),
      req.user ? Like.find({ user: req.user._id, post: { $in: postIds } }).distinct("post") : Promise.resolve([]),
    ]);
    const likeMap = new Map(likeCounts.map((l) => [String(l._id), l.count]));
    const commentMap = new Map(commentCounts.map((c) => [String(c._id), c.count]));
    const likedSet = new Set(likedByMe.map((id) => String(id)));
    return res.status(200).json({ success: true, data: { posts: posts.map((post) => ({ ...post.toObject(), likeCount: likeMap.get(String(post._id)) || 0, commentCount: commentMap.get(String(post._id)) || 0, likedByMe: likedSet.has(String(post._id)) })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  } catch (error) {
    console.error("Get posts error:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve posts." });
  }
};

const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("author", "name username profileImage").populate("celebrity", "name slug profileImage");
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });
    const isOwner = req.user && post.author._id.toString() === req.user._id.toString();
    if (post.status !== "APPROVED" && !isOwner && (!req.user || req.user.role !== "ADMIN")) return res.status(404).json({ success: false, message: "Post not found." });
    const [likeCount, commentCount] = await Promise.all([Like.countDocuments({ post: post._id }), Comment.countDocuments({ post: post._id, status: "APPROVED" })]);
    let likedByMe = false;
    if (req.user) likedByMe = !!(await Like.exists({ user: req.user._id, post: post._id }));
    return res.status(200).json({ success: true, data: { post: { ...post.toObject(), likeCount, commentCount, likedByMe } } });
  } catch (error) {
    console.error("Get post error:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve post." });
  }
};

const createPost = async (req, res) => {
  try {
    const { title, content, image } = req.body;
    const imageUrl = image ? await uploadPostImage(image) : "";
    const post = await Post.create({ author: req.user._id, title, content, image: imageUrl });
    await post.populate("author", "name username profileImage");
    await post.populate("celebrity", "name slug profileImage");
    return res.status(201).json({ success: true, message: "Post created. It will be visible once approved.", data: { post } });
  } catch (error) {
    console.error("Create post error:", error);
    const status = ["CLOUDINARY_NOT_CONFIGURED", "INVALID_IMAGE_FORMAT", "IMAGE_UPLOAD_FAILED"].includes(error.code) ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message || "Unable to create post." });
  }
};

const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });
    const isOwner = post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "ADMIN";
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: "You are not allowed to update this post." });
    const { title, content, image } = req.body;
    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;
    if (image !== undefined) post.image = image ? await uploadPostImage(image) : "";
    if (isOwner && !isAdmin && post.status !== "PENDING") post.status = "PENDING";
    await post.save();
    return res.status(200).json({ success: true, message: "Post updated successfully.", data: { post } });
  } catch (error) {
    console.error("Update post error:", error);
    const status = ["CLOUDINARY_NOT_CONFIGURED", "INVALID_IMAGE_FORMAT", "IMAGE_UPLOAD_FAILED"].includes(error.code) ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message || "Unable to update post." });
  }
};

const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });
    const isOwner = post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "ADMIN";
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: "You are not allowed to delete this post." });
    await Promise.all([post.deleteOne(), Comment.deleteMany({ post: post._id }), Like.deleteMany({ post: post._id })]);
    return res.status(200).json({ success: true, message: "Post deleted successfully." });
  } catch (error) {
    console.error("Delete post error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete post." });
  }
};

module.exports = { getPosts, getPostById, createPost, updatePost, deletePost };
