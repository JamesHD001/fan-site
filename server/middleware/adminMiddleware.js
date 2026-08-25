/*
 * Must run AFTER `authenticate`.
 * Restricts the route to ADMIN users.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message:
        "Administrator access is required for this resource.",
    });
  }

  return next();
};

module.exports = requireAdmin;
