const crypto = require("crypto");
const Gift = require("../models/Gift");
const GiftTransaction = require("../models/GiftTransaction");
const Payment = require("../models/Payment");
const { initializeTransaction, verifyTransaction } = require("../services/paystackService");
const { convertUsdToNgn } = require("../services/paymentService");
const { notifyGiftCompleted } = require("../services/notificationService");

const generateGiftReference = () =>
  `GFT-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const getGifts = async (req, res) => {
  try {
    const gifts = await Gift.find({ isActive: true }).sort({ sortOrder: 1, price: 1 });
    return res.status(200).json({ success: true, data: { gifts } });
  } catch (error) {
    console.error("Get gifts error:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve gifts." });
  }
};

const getMyGiftHistory = async (req, res) => {
  try {
    const transactions = await GiftTransaction.find({ user: req.user._id })
      .populate("gift", "name slug image price currency")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { transactions } });
  } catch (error) {
    console.error("Get gift history error:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve gift history." });
  }
};

const initializeGiftPayment = async (req, res) => {
  try {
    const { giftId, quantity, message } = req.body;
    const qty = Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, 100) : 1;

    if (!giftId) {
      return res.status(400).json({ success: false, message: "Gift is required." });
    }

    const gift = await Gift.findOne({ _id: giftId, isActive: true });
    if (!gift) {
      return res.status(404).json({ success: false, message: "Gift not found." });
    }

    // Gift prices are stored in USD minor units, so multiplication by quantity remains integer-safe.
    const totalUsdMinor = gift.price * qty;
    const { ngnAmountMinor, exchangeRate } = await convertUsdToNgn(totalUsdMinor);
    const reference = generateGiftReference();

    const transaction = await GiftTransaction.create({
      user: req.user._id,
      gift: gift._id,
      reference,
      amount: totalUsdMinor,
      quantity: qty,
      message: message || "",
      status: "PENDING_PAYMENT",
    });

    const payment = await Payment.create({
      user: req.user._id,
      type: "GIFT",
      giftTransaction: transaction._id,
      reference,
      originalAmount: totalUsdMinor,
      originalCurrency: gift.currency || "USD",
      amount: ngnAmountMinor,
      currency: "NGN",
      exchangeRate,
      provider: "PAYSTACK",
      status: "PENDING",
    });

    transaction.payment = payment._id;
    await transaction.save();

    try {
      const paystackResponse = await initializeTransaction({
        email: req.user.email,
        amount: ngnAmountMinor,
        currency: "NGN",
        reference,
        metadata: JSON.stringify({
          paymentId: payment._id.toString(),
          giftTransactionId: transaction._id.toString(),
          userId: req.user._id.toString(),
          giftId: gift._id.toString(),
          quantity: qty,
        }),
        callbackUrl: `${process.env.CLIENT_URL}/payment/callback`,
      });

      return res.status(201).json({
        success: true,
        message: "Gift payment initialized successfully.",
        transaction: {
          id: transaction._id,
          reference,
          gift: {
            id: gift._id,
            name: gift.name,
            price: gift.price,
            currency: gift.currency,
          },
          quantity: qty,
          totalUsdMinor,
          status: transaction.status,
        },
        payment: {
          amount: ngnAmountMinor,
          currency: "NGN",
          exchangeRate,
        },
        checkout: {
          authorizationUrl: paystackResponse.data.authorization_url,
          accessCode: paystackResponse.data.access_code,
          reference: paystackResponse.data.reference,
        },
      });
    } catch (paystackError) {
      await Payment.findByIdAndUpdate(payment._id, { status: "FAILED" });
      await GiftTransaction.findByIdAndUpdate(transaction._id, { status: "FAILED" });
      throw paystackError;
    }
  } catch (error) {
    console.error("Initialize gift payment error:", error);
    return res.status(500).json({ success: false, message: error.message || "Unable to initialize gift payment." });
  }
};

const verifyGiftPayment = async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ success: false, message: "Payment reference is required." });
    }

    const payment = await Payment.findOne({ reference, user: req.user._id, type: "GIFT" });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found." });
    }

    const giftTransaction = await GiftTransaction.findById(payment.giftTransaction).populate("gift");
    if (!giftTransaction) {
      return res.status(404).json({ success: false, message: "Gift transaction not found." });
    }

    if (payment.status === "SUCCESS") {
      return res.status(200).json({
        success: true,
        message: "Payment has already been verified.",
        payment,
        transaction: giftTransaction,
      });
    }

    const paystackResponse = await verifyTransaction(reference);
    const transactionData = paystackResponse.data;

    if (transactionData.reference !== payment.reference) {
      return res.status(400).json({ success: false, message: "Payment reference mismatch." });
    }

    // Paystack transaction amounts are already in minor units.
    if (Number(transactionData.amount) !== payment.amount) {
      return res.status(400).json({ success: false, message: "Payment amount mismatch." });
    }

    if (transactionData.currency.toUpperCase() !== payment.currency.toUpperCase()) {
      return res.status(400).json({ success: false, message: "Payment currency mismatch." });
    }

    if (transactionData.status !== "success") {
      payment.status = transactionData.status === "abandoned" ? "ABANDONED" : "FAILED";
      payment.providerResponse = transactionData;
      await payment.save();
      return res.status(400).json({ success: false, message: "Payment was not successful.", status: transactionData.status });
    }

    if (giftTransaction.status !== "COMPLETED") {
      giftTransaction.status = "COMPLETED";
      await giftTransaction.save();
    }

    payment.status = "SUCCESS";
    payment.paidAt = transactionData.paid_at ? new Date(transactionData.paid_at) : new Date();
    payment.providerTransactionId = String(transactionData.id);
    payment.providerResponse = transactionData;
    await payment.save();

    await notifyGiftCompleted(req.user._id.toString(), giftTransaction.gift.name, giftTransaction.quantity);

    return res.status(200).json({
      success: true,
      message: "Payment verified and gift sent successfully.",
      transaction: giftTransaction,
    });
  } catch (error) {
    console.error("Verify gift payment error:", error);
    return res.status(500).json({ success: false, message: error.message || "Unable to verify gift payment." });
  }
};

module.exports = { getGifts, getMyGiftHistory, initializeGiftPayment, verifyGiftPayment };
