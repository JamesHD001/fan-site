const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "REMOVED"],
      default: "APPROVED",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Comment", commentSchema);
