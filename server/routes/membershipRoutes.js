const express = require("express");

const {
  getMembershipPlans,
  initializeMembershipPayment,
} = require("../controllers/membershipController");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.get("/plans", getMembershipPlans);

router.post(
  "/initialize",
  authenticate,
  initializeMembershipPayment
);

module.exports = router;