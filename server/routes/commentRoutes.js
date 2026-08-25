const express = require("express");

const {
  getCommentsForPost,
  createComment,
  deleteComment,
} = require("../controllers/commentController");

const authenticate = require("../middleware/authenticate");

const router = express.Router({ mergeParams: true });

router.get(
  "/posts/:postId/comments",
  getCommentsForPost
);
router.post(
  "/posts/:postId/comments",
  authenticate,
  createComment
);
router.delete("/comments/:id", authenticate, deleteComment);

module.exports = router;
