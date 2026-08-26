// server/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid identifier." });
  }
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate value." });
  }

  return res.status(err.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Something went wrong." : err.message,
  });
};

module.exports = errorHandler;