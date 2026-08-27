const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");

const ensureWallet = async (userId, session = null) => {
  if (!userId) throw new Error("User is required to access a wallet.");

  const query = Wallet.findOne({ user: userId });
  if (session) query.session(session);
  let wallet = await query;

  if (!wallet) {
    try {
      wallet = await Wallet.create([{ user: userId }], session ? { session } : undefined);
      wallet = wallet[0];
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const retry = Wallet.findOne({ user: userId });
      if (session) retry.session(session);
      wallet = await retry;
    }
  }

  return wallet;
};

const creditWallet = async ({
  userId,
  amount,
  type = "DEPOSIT",
  reference,
  paymentId = null,
  description = "",
  metadata = null,
  session,
}) => {
  if (!session) throw new Error("Wallet credit requires a database session.");
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Wallet credit amount must be a positive integer minor-unit amount.");
  }
  if (!reference) throw new Error("Wallet transaction reference is required.");

  const existing = await WalletTransaction.findOne({ reference }).session(session);
  if (existing) return { wallet: await Wallet.findById(existing.wallet).session(session), transaction: existing, alreadyApplied: true };

  const wallet = await Wallet.findOneAndUpdate(
    { user: userId },
    { $inc: { availableBalance: amount } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );

  const [transaction] = await WalletTransaction.create(
    [{ wallet: wallet._id, user: userId, reference, type, direction: "CREDIT", amount, currency: wallet.currency, status: "COMPLETED", payment: paymentId, description, metadata }],
    { session }
  );

  return { wallet, transaction, alreadyApplied: false };
};

const debitWallet = async ({
  userId,
  amount,
  reference,
  paymentId = null,
  description = "",
  metadata = null,
  session,
}) => {
  if (!session) throw new Error("Wallet debit requires a database session.");
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Wallet debit amount must be a positive integer minor-unit amount.");
  }
  if (!reference) throw new Error("Wallet transaction reference is required.");

  const existing = await WalletTransaction.findOne({ reference }).session(session);
  if (existing) return { wallet: await Wallet.findById(existing.wallet).session(session), transaction: existing, alreadyApplied: true };

  const wallet = await Wallet.findOneAndUpdate(
    { user: userId, availableBalance: { $gte: amount } },
    { $inc: { availableBalance: -amount } },
    { new: true, session }
  );

  if (!wallet) throw new Error("Insufficient platform credit balance.");

  const [transaction] = await WalletTransaction.create(
    [{ wallet: wallet._id, user: userId, reference, type: "PURCHASE", direction: "DEBIT", amount, currency: wallet.currency, status: "COMPLETED", payment: paymentId, description, metadata }],
    { session }
  );

  return { wallet, transaction, alreadyApplied: false };
};

const getWallet = async (userId) => ensureWallet(userId);

const getWalletTransactions = async (userId, { page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const wallet = await ensureWallet(userId);
  const [transactions, total] = await Promise.all([
    WalletTransaction.find({ wallet: wallet._id }).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    WalletTransaction.countDocuments({ wallet: wallet._id }),
  ]);

  return { wallet, transactions, pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } };
};

module.exports = { ensureWallet, creditWallet, debitWallet, getWallet, getWalletTransactions };
