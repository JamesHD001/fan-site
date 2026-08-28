const Payment = require("../models/Payment");
const PaymentMethod = require("../models/PaymentMethod");
const { extractCardToken, extractCardMetadata } = require("../services/flutterwaveTokenService");

const saveCardFromPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({ reference: req.body.reference, user: req.user._id, provider: "FLUTTERWAVE", type: "DEPOSIT", status: "SUCCESS" }).lean();
    if (!payment) return res.status(404).json({ success: false, message: "A completed Flutterwave payment could not be found." });
    const transaction = payment.providerResponse || {};
    const token = extractCardToken(transaction);
    if (!token) return res.status(422).json({ success: false, message: "Flutterwave did not return a reusable card token for this payment." });
    const existing = await PaymentMethod.findOne({ user: req.user._id, provider: "FLUTTERWAVE", token }).select("-token");
    if (existing) return res.json({ success: true, alreadySaved: true, paymentMethod: existing });
    const hasDefault = await PaymentMethod.exists({ user: req.user._id, status: "ACTIVE", isDefault: true });
    const metadata = extractCardMetadata(transaction);
    const method = await PaymentMethod.create({
      user: req.user._id, provider: "FLUTTERWAVE", type: "CARD", token,
      email: req.user.email.toLowerCase(), ...metadata, isDefault: !hasDefault,
      metadata: { sourcePayment: payment._id.toString() },
    });
    const safe = method.toObject();
    delete safe.token;
    return res.status(201).json({ success: true, paymentMethod: safe });
  } catch (error) {
    console.error("Save Flutterwave card error:", error);
    return res.status(500).json({ success: false, message: "Unable to save this payment method." });
  }
};

module.exports = { saveCardFromPayment };
