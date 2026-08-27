const Membership = require("../models/Membership");
const Booking = require("../models/Booking");
const GiftTransaction = require("../models/GiftTransaction");
const Payment = require("../models/Payment");
const { creditWallet } = require("./walletService");
const { calculateExpiryDate, generateMembershipNumber } = require("../utils/membership");

/**
 * Persist provider-reported fee/tax/settlement and transaction id on a payment.
 * Shared by the webhook and client-side verify paths so both record identical
 * accounting data. Fee/tax values never affect payment validation.
 */
const applyProviderTransactionDetails = (payment, transaction) => {
  if (transaction.id !== undefined && transaction.id !== null) {
    payment.providerTransactionId = String(transaction.id);
  }
  if (transaction.fee !== undefined && Number.isFinite(Number(transaction.fee))) {
    payment.providerFee = Number(transaction.fee);
  }
  if (transaction.tax !== undefined && Number.isFinite(Number(transaction.tax))) {
    payment.providerTax = Number(transaction.tax);
  }
  if (transaction.amount_settled !== undefined && Number.isFinite(Number(transaction.amount_settled))) {
    payment.providerNetSettlement = Number(transaction.amount_settled);
  }
};

const settleSuccessfulPayment = async ({ paymentId, transaction, session }) => {
  if (!paymentId || !transaction || !session) {
    throw new Error("Payment settlement requires paymentId, transaction and session.");
  }

  const payment = await Payment.findById(paymentId).session(session);
  if (!payment) throw new Error("Payment record not found.");

  if (payment.status === "SUCCESS") {
    return {
      payment,
      alreadySettled: true,
      notification: null,
      result: await getSettlementResult(payment, session),
    };
  }

  // Atomic claim: a concurrent webhook and client-side verify can both reach
  // this point before either commits, so the pre-check above is not sufficient.
  // claimForSettlement transitions PENDING/PROCESSING -> PROCESSING atomically;
  // a null result means another path has already claimed (or resolved) it.
  const claimed = await Payment.claimForSettlement(payment._id, session);
  if (!claimed) {
    return {
      payment,
      alreadySettled: payment.status === "SUCCESS",
      notification: null,
      result: payment.status === "SUCCESS" ? await getSettlementResult(payment, session) : {},
    };
  }

  if (payment.type === "DEPOSIT") {
    const creditAmount = Number(payment.originalAmount);
    if (!Number.isInteger(creditAmount) || creditAmount <= 0) {
      throw new Error("Deposit credit amount is invalid.");
    }

    const walletResult = await creditWallet({
      userId: payment.user,
      amount: creditAmount,
      type: "DEPOSIT",
      reference: `WAL-${payment.reference}`,
      paymentId: payment._id,
      description: "Wallet funding deposit",
      metadata: {
        provider: payment.provider,
        providerTransactionId: transaction.id || null,
        providerCurrency: payment.currency,
        providerAmount: payment.amount,
        exchangeRate: payment.exchangeRate,
      },
      session,
    });

    markPaymentSuccessful(payment, transaction);
    await payment.save({ session });

    return {
      payment,
      alreadySettled: walletResult.alreadyApplied,
      notification: null,
      result: { wallet: walletResult.wallet, transaction: walletResult.transaction },
    };
  }

  if (payment.type === "MEMBERSHIP") {
    const membership = await Membership.findById(payment.membership).populate("plan").session(session);
    if (!membership) throw new Error("Membership record not found.");

    if (membership.status !== "ACTIVE") {
      const startDate = new Date();
      membership.status = "ACTIVE";
      membership.startedAt = startDate;
      membership.expiresAt = calculateExpiryDate(startDate, membership.plan);
      if (!membership.membershipNumber) membership.membershipNumber = generateMembershipNumber();
      await membership.save({ session });
    }

    markPaymentSuccessful(payment, transaction);
    await payment.save({ session });
    return {
      payment,
      alreadySettled: false,
      notification: { type: "MEMBERSHIP", userId: membership.user.toString(), membershipNumber: membership.membershipNumber },
      result: { membership },
    };
  }

  if (payment.type === "MEETING") {
    const booking = await Booking.findById(payment.booking).populate("meetingType").session(session);
    if (!booking) throw new Error("Booking record not found.");
    if (booking.status === "PENDING_PAYMENT") {
      booking.status = "CONFIRMED";
      booking.confirmedAt = new Date();
      await booking.save({ session });
    }
    markPaymentSuccessful(payment, transaction);
    await payment.save({ session });
    return {
      payment,
      alreadySettled: false,
      notification: { type: "MEETING", userId: booking.user.toString(), reference: booking.reference, scheduledFor: booking.scheduledFor },
      result: { booking },
    };
  }

  if (payment.type === "GIFT") {
    const giftTransaction = await GiftTransaction.findById(payment.giftTransaction).populate("gift").session(session);
    if (!giftTransaction) throw new Error("Gift transaction not found.");
    if (giftTransaction.status === "PENDING_PAYMENT") {
      giftTransaction.status = "COMPLETED";
      await giftTransaction.save({ session });
    }
    markPaymentSuccessful(payment, transaction);
    await payment.save({ session });
    return {
      payment,
      alreadySettled: false,
      notification: { type: "GIFT", userId: giftTransaction.user.toString(), giftName: giftTransaction.gift.name, quantity: giftTransaction.quantity },
      result: { transaction: giftTransaction },
    };
  }

  throw new Error(`Unsupported payment type: ${payment.type}`);
};

const markPaymentSuccessful = (payment, transaction) => {
  payment.status = "SUCCESS";
  payment.paidAt = transaction.paid_at ? new Date(transaction.paid_at) : new Date();
  applyProviderTransactionDetails(payment, transaction);
  payment.providerResponse = transaction;
};

const getSettlementResult = async (payment, session) => {
  if (payment.type === "DEPOSIT") return {};
  if (payment.type === "MEMBERSHIP") {
    return { membership: await Membership.findById(payment.membership).populate("plan").session(session) };
  }
  if (payment.type === "MEETING") {
    return { booking: await Booking.findById(payment.booking).populate("meetingType").session(session) };
  }
  if (payment.type === "GIFT") {
    return { transaction: await GiftTransaction.findById(payment.giftTransaction).populate("gift").session(session) };
  }
  return {};
};

module.exports = { settleSuccessfulPayment, applyProviderTransactionDetails };
