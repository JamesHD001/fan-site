const express = require("express");

const {
  register,
  login,
  getCurrentUser,
} = require("../controllers/authController");

const authenticate = require("../middleware/authenticate");

const validate = require("../middleware/validate");

const {
  registerValidator,
  loginValidator,
} = require("../validators/authvalidator");

const router = express.Router();

router.post(
  "/register",
  registerValidator,
  validate,
  register
);

router.post(
  "/login",
  loginValidator,
  validate,
  login
);

router.get(
  "/me",
  authenticate,
  getCurrentUser
);

module.exports = router;