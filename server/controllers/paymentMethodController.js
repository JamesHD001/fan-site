const mongoose = require("mongoose");
const PaymentMethod = require("../models/PaymentMethod");

const listPaymentMethods = async (req, res) => {
  const methods = await PaymentMethod.find({ user: req.user._id, status: "ACTIVE" })
    .select("-token")
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();
  return res.json({ success: true, paymentMethods: methods });
};

const setDefaultPaymentMethod = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid payment method." });
  const method = await PaymentMethod.findOne({ _id: id, user: req.user._id, status: "ACTIVE" });
  if (!method) return res.status(404).json({ success: false, message: "Payment method not found." });
  await PaymentMethod.updateMany({ user: req.user._id, status: "ACTIVE" }, { $set: { isDefault: false } });
  method.isDefault = true;
  await method.save();
  return res.json({ success: true, paymentMethod: { ...method.toObject(), token: undefined } });
};

const removePaymentMethod = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid payment method." });
  const method = await PaymentMethod.findOne({ _id: id, user: req.user._id, status: "ACTIVE" });
  if (!method) return res.status(404).json({ success: false, message: "Payment method not found." });
  method.status = "DISABLED";
  method.isDefault = false;
  await method.save();

  if (await PaymentMethod.countDocuments({ user: req.user._id, status: "ACTIVE" }) > 0) {
    const replacement = await PaymentMethod.findOne({ user: req.user._id, status: "ACTIVE" }).sort({ createdAt: -1 });
    if (replacement && !(await PaymentMethod.exists({ user: req.user._id, status: "ACTIVE", isDefault: true }))) {
      replacement.isDefault = true;
      await replacement.save();
    }
  }
  return res.json({ success: true, message: "Payment method removed." });
};

module.exports = { listPaymentMethods, setDefaultPaymentMethod, removePaymentMethod };
