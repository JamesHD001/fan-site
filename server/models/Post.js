const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    celebrity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Celebrity",
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5000,
    },

    image: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "REMOVED"],
      default: "PENDING",
      index: true,
    },

    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

postSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
