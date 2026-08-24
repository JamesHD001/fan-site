const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const membershipRoutes = require("./routes/membershipRoutes");

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Request body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/memberships", membershipRoutes);


// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Keanu Reeves Fan Community API is running.",
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;