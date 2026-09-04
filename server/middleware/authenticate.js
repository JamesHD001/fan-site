const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Authentication token is missing." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) return res.status(401).json({ success: false, message: "User associated with this token no longer exists." });
    if (!user.isActive) return res.status(403).json({ success: false, message: "This account has been disabled." });

    // A password change invalidates all JWTs issued before that change.
    if (user.passwordChangedAt && decoded.iat && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
      return res.status(401).json({ success: false, message: "Your session has expired because your password was changed. Please sign in again." });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") return res.status(401).json({ success: false, message: "Authentication token has expired." });
    if (error.name === "JsonWebTokenError") return res.status(401).json({ success: false, message: "Invalid authentication token." });
    console.error("Authentication error:", error);
    return res.status(500).json({ success: false, message: "Authentication failed." });
  }
};

module.exports = authenticate;
