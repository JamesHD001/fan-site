const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["PAYMENT", "MEMBERSHIP", "BOOKING", "GIFT", "EVENT", "POST", "SYSTEM"], required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    link: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ user: 1, "metadata.key": 1, "metadata.membershipId": 1 });

module.exports = mongoose.model("Notification", notificationSchema);
