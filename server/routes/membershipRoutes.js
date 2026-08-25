const express = require("express");

const {
  getMembershipPlans,
  initializeMembershipPayment,
  verifyMembershipPayment,
  getMyMembership,
  getPaymentHistory,
  getMembershipCard,
} = require("../controllers/membershipController");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.get("/plans", getMembershipPlans);

router.post(
  "/initialize",
  authenticate,
  initializeMembershipPayment
);

router.post(
  "/verify",
  authenticate,
  verifyMembershipPayment
);

router.get(
  "/payments",
  authenticate,
  getPaymentHistory
);

router.get(
  "/card",
  authenticate,
  getMembershipCard
);

router.get(
  "/me",
  authenticate,
  getMyMembership
);

module.exports = router;