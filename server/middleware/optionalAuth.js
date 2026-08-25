const jwt = require("jsonwebtoken");
const User = require("../models/User");

/*
 * Like `authenticate`, but does not reject
 * unauthenticated requests. Attaches req.user
 * when a valid token is present.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.userId);

    if (user && user.isActive) {
      req.user = user;
    }

    return next();
  } catch (error) {
    // Invalid/expired tokens are ignored for optional auth
    return next();
  }
};

module.exports = optionalAuth;
