const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const authRoutes = require("./routes/authRoutes");
const otpRoutes = require("./routes/otpRoutes");
const membershipRoutes = require("./routes/membershipRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const paystackRoutes = require("./routes/paystackRoutes");
const walletRoutes = require("./routes/walletRoutes");
const postRoutes = require("./routes/postRoutes");
const commentRoutes = require("./routes/commentRoutes");
const likeRoutes = require("./routes/likeRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const giftRoutes = require("./routes/giftRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const eventRoutes = require("./routes/eventRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const errorHandler = require("./middleware/errorHandler");
const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));

// Webhook routes that require raw request bodies must be registered before JSON parsing.
app.use("/api/paystack", paystackRoutes);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/memberships", membershipRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/posts", postRoutes);
app.use("/api", commentRoutes);
app.use("/api", likeRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/gifts", giftRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/api/health", (req, res) => res.status(200).json({ success: true, message: "Keanu Reeves Fan Community API is running.", timestamp: new Date().toISOString() }));
app.use(errorHandler);

module.exports = app;
