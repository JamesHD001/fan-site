const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const membershipRoutes = require("./routes/membershipRoutes");
const paystackRoutes = require("./routes/paystackRoutes");
const postRoutes = require("./routes/postRoutes");
const commentRoutes = require("./routes/commentRoutes");
const likeRoutes = require("./routes/likeRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const giftRoutes = require("./routes/giftRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const eventRoutes = require("./routes/eventRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      "http://localhost:5173",
    credentials: true,
  })
);

// Paystack webhook
// Must be registered BEFORE express.json()
app.use("/api/paystack", paystackRoutes);

// Request body parsing
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

// Logging
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/memberships", membershipRoutes);
app.use("/api/posts", postRoutes);
app.use("/api", commentRoutes);
app.use("/api", likeRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/gifts", giftRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "Keanu Reeves Fan Community API is running.",
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;