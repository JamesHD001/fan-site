const crypto = require("crypto");

const MembershipPlan = require("../models/MembershipPlan");
const Membership = require("../models/Membership");
const Payment = require("../models/Payment");

const {
  initializeTransaction,
  verifyTransaction,
} = require("../services/paystackService");

const {
  expireMembershipIfNecessary,
} = require("../services/membershipService");
const { toSubunit } = require("../utils/currency");
const { convertUsdToNgn } = require("../services/paymentService");
const { notifyMembershipActivated } = require("../services/notificationService");

const {
  generateMembershipNumber,
  calculateExpiryDate,
} = require("../utils/membership");

const getMyMembership = async (req, res) => {
  try {
    let membership = await Membership.findOne({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .populate("plan");

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "You do not have a membership.",
      });
    }

    membership =
      await expireMembershipIfNecessary(
        membership
      );

    if (membership.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        message: "You do not have an active membership.",
        membership,
      });
    }

    return res.status(200).json({
      success: true,
      membership,
    });
  } catch (error) {
    console.error(
      "Get membership error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve membership.",
    });
  }
};

const verifyMembershipPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required.",
      });
    }

    const payment = await Payment.findOne({
      reference,
      user: req.user._id,
      type: "MEMBERSHIP",
    }).populate("membership");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found.",
      });
    }

    // Idempotency:
    // If this payment was already successfully processed,
    // don't process it again.
    if (payment.status === "SUCCESS") {
      const membership = await Membership.findById(
        payment.membership
      ).populate("plan");

      return res.status(200).json({
        success: true,
        message: "Payment has already been verified.",
        payment,
        membership,
      });
    }

    const paystackResponse = await verifyTransaction(reference);

    const transaction = paystackResponse.data;

    // Verify the reference returned by Paystack.
    if (transaction.reference !== payment.reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference mismatch.",
      });
    }

    // Convert our stored amount into Paystack's expected subunit.
    const expectedAmount = toSubunit(
      payment.amount,
      payment.currency
    );

    if (Number(transaction.amount) !== expectedAmount) {
      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch.",
      });
    }

    if (
      transaction.currency.toUpperCase() !==
      payment.currency.toUpperCase()
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment currency mismatch.",
      });
    }

    if (transaction.status !== "success") {
      payment.status =
        transaction.status === "abandoned"
          ? "ABANDONED"
          : "FAILED";

      payment.providerResponse = transaction;

      await payment.save();

      return res.status(400).json({
        success: false,
        message: "Payment was not successful.",
        status: transaction.status,
      });
    }

    const membership = await Membership.findById(
      payment.membership
    ).populate("plan");

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Membership record not found.",
      });
    }

    // Prevent accidental activation if the membership
    // was already processed.
    if (membership.status === "ACTIVE") {
      payment.status = "SUCCESS";

      payment.paidAt = transaction.paid_at
        ? new Date(transaction.paid_at)
        : new Date();

      payment.providerTransactionId =
        String(transaction.id);

      payment.providerResponse = transaction;

      await payment.save();

      return res.status(200).json({
        success: true,
        message: "Membership is already active.",
        payment,
        membership,
      });
    }

    const startDate = new Date();

    const expiryDate = calculateExpiryDate(
      startDate,
      membership.plan
    );

    membership.status = "ACTIVE";
    membership.startedAt = startDate;
    membership.expiresAt = expiryDate;

    if (!membership.membershipNumber) {
      membership.membershipNumber =
        generateMembershipNumber();
    }

    await membership.save();

    payment.status = "SUCCESS";

    payment.paidAt = transaction.paid_at
      ? new Date(transaction.paid_at)
      : new Date();

    payment.providerTransactionId =
      String(transaction.id);

    payment.providerResponse = transaction;

    await payment.save();

    await notifyMembershipActivated(
      req.user._id.toString(),
      membership.membershipNumber
    );

    return res.status(200).json({
      success: true,
      message:
        "Payment verified and membership activated successfully.",
      payment,
      membership: {
        id: membership._id,
        membershipNumber:
          membership.membershipNumber,
        status: membership.status,
        startedAt: membership.startedAt,
        expiresAt: membership.expiresAt,
        plan: membership.plan,
      },
    });
  } catch (error) {
    console.error(
      "Verify membership payment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to verify membership payment.",
    });
  }
};

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
    console.error(
      "Get membership plans error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve membership plans.",
    });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({
      user: req.user._id,
    })
      .populate({
        path: "membership",
        populate: {
          path: "plan",
          select:
            "name slug price currency duration durationUnit",
        },
      })
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error(
      "Get payment history error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve payment history.",
    });
  }
};

const getMembershipCard = async (req, res) => {
  try {
    let membership = await Membership.findOne({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .populate("plan")
      .populate(
        "user",
        "name username email profileImage"
      );

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Membership not found.",
      });
    }

    membership =
      await expireMembershipIfNecessary(membership);

    if (membership.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message:
          "An active membership is required to access the membership card.",
      });
    }

    return res.status(200).json({
      success: true,
      card: {
        memberName: membership.user.name,
        username: membership.user.username,
        profileImage:
          membership.user.profileImage,

        membershipNumber:
          membership.membershipNumber,

        membershipType:
          membership.plan.name,

        badge:
          membership.plan.badge,

        cardDesign:
          membership.plan.cardDesign,

        startedAt:
          membership.startedAt,

        expiresAt:
          membership.expiresAt,

        status:
          membership.status,
      },
    });
  } catch (error) {
    console.error(
      "Get membership card error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve membership card.",
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

    // Convert USD price to NGN for Paystack checkout
    const { ngnAmount, exchangeRate } =
      await convertUsdToNgn(plan.price);

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
      originalAmount: plan.price,
      originalCurrency: plan.currency,
      amount: ngnAmount,
      currency: "NGN",
      exchangeRate,
      provider: "PAYSTACK",
      status: "PENDING",
    });

    try {
      const paystackResponse =
        await initializeTransaction({
          email: req.user.email,
          amount: toSubunit(
            ngnAmount,
            "NGN"
          ),
          currency: "NGN",
          reference,
          metadata: JSON.stringify({
            paymentId: payment._id.toString(),
            membershipId: membership._id.toString(),
            userId: req.user._id.toString(),
            planId: plan._id.toString(),
          }),
          callbackUrl:
            `${process.env.CLIENT_URL}/payment/callback`,
        });

      return res.status(201).json({
        success: true,
        message:
          "Membership payment initialized successfully.",
        payment: {
          id: payment._id,
          reference,
          originalAmount: plan.price,
          originalCurrency: plan.currency,
          amount: ngnAmount,
          currency: "NGN",
          exchangeRate,
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
      await Payment.findByIdAndUpdate(
        payment._id,
        {
          status: "FAILED",
        }
      );

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
  verifyMembershipPayment,
  getMyMembership,
  getPaymentHistory,
  getMembershipCard,
};