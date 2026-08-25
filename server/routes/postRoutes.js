const express = require("express");

const {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
} = require("../controllers/postController");

const authenticate = require("../middleware/authenticate");
const optionalAuth = require("../middleware/optionalAuth");

const router = express.Router();

router.get("/", optionalAuth, getPosts);
router.get("/:id", optionalAuth, getPostById);
router.post("/", authenticate, createPost);
router.patch("/:id", authenticate, updatePost);
router.delete("/:id", authenticate, deletePost);

module.exports = router;
