const express = require("express");

const { toggleLike } = require("../controllers/likeController");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.post(
  "/posts/:postId/like",
  authenticate,
  toggleLike
);

module.exports = router;
