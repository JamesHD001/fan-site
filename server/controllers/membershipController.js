const crypto = require("crypto");

const MembershipPlan = require("../models/MembershipPlan");
const Membership = require("../models/Membership");
const Payment = require("../models/Payment");

const {
  initializeTransaction,
} = require("../services/paystackService");

const { toSubunit } = require("../utils/currency");

const getMembershipPlans = async (req, res) => {
  try {
    const plans = await MembershipPlan.find({
      isActive: true,
    }).sort({
      sortOrder: 1,
      price: 1,
    });

    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("Get membership plans error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve membership plans.",
    });
  }
};

const initializeMembershipPayment = async (req, res) => {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Membership plan is required.",
      });
    }

    const plan = await MembershipPlan.findOne({
      _id: planId,
      isActive: true,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Membership plan not found.",
      });
    }

    const existingMembership = await Membership.findOne({
      user: req.user._id,
      status: "ACTIVE",
      expiresAt: {
        $gt: new Date(),
      },
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message:
          "You already have an active membership.",
      });
    }

    const reference = `MEM-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    const membership = await Membership.create({
      user: req.user._id,
      plan: plan._id,
      status: "PENDING",
    });

    const payment = await Payment.create({
      user: req.user._id,
      type: "MEMBERSHIP",
      membership: membership._id,
      reference,
      amount: plan.price,
      currency: plan.currency,
      provider: "PAYSTACK",
      status: "PENDING",
    });

    try {
      const paystackResponse =
        await initializeTransaction({
          email: req.user.email,
          amount: toSubunit(
            plan.price,
            plan.currency
          ),
          currency: plan.currency,
          reference,
          metadata: JSON.stringify({
            paymentId: payment._id.toString(),
            membershipId: membership._id.toString(),
            userId: req.user._id.toString(),
            planId: plan._id.toString(),
          }),
          callbackUrl: `${process.env.CLIENT_URL}/payment/callback`,
        });

      return res.status(201).json({
        success: true,
        message:
          "Membership payment initialized successfully.",
        payment: {
          id: payment._id,
          reference,
          amount: plan.price,
          currency: plan.currency,
          status: payment.status,
        },
        membership: {
          id: membership._id,
          plan: plan.name,
          status: membership.status,
        },
        checkout: {
          authorizationUrl:
            paystackResponse.data.authorization_url,
          accessCode:
            paystackResponse.data.access_code,
          reference:
            paystackResponse.data.reference,
        },
      });
    } catch (paystackError) {
      await Payment.findByIdAndUpdate(payment._id, {
        status: "FAILED",
      });

      await Membership.findByIdAndUpdate(
        membership._id,
        {
          status: "CANCELLED",
        }
      );

      throw paystackError;
    }
  } catch (error) {
    console.error(
      "Initialize membership payment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to initialize membership payment.",
    });
  }
};

module.exports = {
  getMembershipPlans,
  initializeMembershipPayment,
};