const mongoose = require('mongoose');
const Membership = require('../models/Membership');
const Booking = require('../models/Booking');
const GiftTransaction = require('../models/GiftTransaction');
const Payment = require('../models/Payment');

const invalid = (id) => !mongoose.isValidObjectId(id);
const notFound = (res, message) => res.status(404).json({ success: false, message });

const getMemberships = async (req, res) => {
  try {
    const memberships = await Membership.find().populate('user', 'name username email').populate('plan', 'name price currency').sort({ createdAt: -1 });
    return res.json({ success: true, data: { memberships } });
  } catch (e) { return res.status(500).json({ success: false, message: 'Unable to retrieve memberships.' }); }
};

const deleteMembership = async (req, res) => {
  try {
    if (invalid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid membership id.' });
    const membership = await Membership.findById(req.params.id);
    if (!membership) return notFound(res, 'Membership purchase not found.');
    await Payment.deleteMany({ membership: membership._id });
    await Membership.deleteOne({ _id: membership._id });
    return res.json({ success: true, message: 'Membership purchase deleted successfully.' });
  } catch (e) { return res.status(500).json({ success: false, message: 'Unable to delete membership purchase.' }); }
};

const deleteBooking = async (req, res) => {
  try {
    if (invalid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid booking id.' });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return notFound(res, 'Meeting booking not found.');
    await Payment.deleteMany({ booking: booking._id });
    await Booking.deleteOne({ _id: booking._id });
    return res.json({ success: true, message: 'Meeting booking deleted successfully.' });
  } catch (e) { return res.status(500).json({ success: false, message: 'Unable to delete meeting booking.' }); }
};

const deleteGiftTransaction = async (req, res) => {
  try {
    if (invalid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid gift transaction id.' });
    const transaction = await GiftTransaction.findById(req.params.id);
    if (!transaction) return notFound(res, 'Gift purchase not found.');
    await Payment.deleteMany({ giftTransaction: transaction._id });
    await GiftTransaction.deleteOne({ _id: transaction._id });
    return res.json({ success: true, message: 'Gift purchase deleted successfully.' });
  } catch (e) { return res.status(500).json({ success: false, message: 'Unable to delete gift purchase.' }); }
};

const deletePayment = async (req, res) => {
  try {
    if (invalid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid payment id.' });
    const payment = await Payment.findById(req.params.id);
    if (!payment) return notFound(res, 'Payment record not found.');
    if (payment.membership) await Membership.deleteOne({ _id: payment.membership });
    if (payment.booking) await Booking.deleteOne({ _id: payment.booking });
    if (payment.giftTransaction) await GiftTransaction.deleteOne({ _id: payment.giftTransaction });
    await Payment.deleteOne({ _id: payment._id });
    return res.json({ success: true, message: 'Payment and its associated purchase record were deleted successfully.' });
  } catch (e) { return res.status(500).json({ success: false, message: 'Unable to delete payment record.' }); }
};

module.exports = { getMemberships, deleteMembership, deleteBooking, deleteGiftTransaction, deletePayment };
