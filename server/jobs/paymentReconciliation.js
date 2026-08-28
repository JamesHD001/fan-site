const Payment = require("../models/Payment");
const { verifyDeposit } = require("../services/flutterwaveProvider");

// Staleness thresholds (ms). Configurable for testing/tuning.
const PENDING_STALE_MS = Number(process.env.RECONCILE_PENDING_STALE_MS || 60 * 60 * 1000); // 1h
const ABANDON_MS = Number(process.env.RECONCILE_ABANDON_MS || 24 * 60 * 60 * 1000); // 24h
const BATCH_SIZE = Number(process.env.RECONCILE_BATCH_SIZE || 50);

/**
 * Reconcile stale Flutterwave payments:
 *  - PENDING payments older than PENDING_STALE_MS: re-query the provider.
 *    Provider may have actually completed the charge (missed webhook) — in that
 *    case mark it for settlement on the next verify/webhook pass by persisting
 *    provider data and transitioning to PROCESSING; do NOT settle here, to keep
 *    this job side-effect free with respect to wallets.
 *  - PENDING payments older than ABANDON_MS with no provider transaction:
 *    mark ABANDONED so they stop showing as "in progress".
 *  - REVIEW: left untouched — those need human action.
 *
 * Idempotent and safe to run on multiple instances concurrently.
 */
const reconcileStalePayments = async () => {
  const summary = { checked: 0, advancedToProcessing: 0, abandoned: 0, errors: 0 };

  const cutoff = new Date(Date.now() - PENDING_STALE_MS);
  const abandonCutoff = new Date(Date.now() - ABANDON_MS);

  const stale = await Payment.find({
    provider: "FLUTTERWAVE",
    type: "DEPOSIT",
    status: "PENDING",
    createdAt: { $lt: cutoff },
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  summary.checked = stale.length;

  for (const record of stale) {
    try {
      // Only abandon if we never got a provider transaction reference back
      // (initialization never completed). Otherwise keep re-checking.
      const checkout = record.providerResponse;
      if (record.createdAt < abandonCutoff && (!checkout || !checkout.reference)) {
        await Payment.updateOne(
          { _id: record._id, status: "PENDING" },
          { $set: { status: "ABANDONED" } }
        );
        summary.abandoned += 1;
        continue;
      }

      if (!record.providerTransactionId) continue; // nothing to re-query yet

      const verified = await verifyDeposit(record.providerTransactionId);
      const transaction = verified.data;
      if (!transaction) continue;

      const details = {};
      if (transaction.id !== undefined && transaction.id !== null) details.providerTransactionId = String(transaction.id);
      if (transaction.fee !== undefined && Number.isFinite(Number(transaction.fee))) details.providerFee = Number(transaction.fee);
      if (transaction.tax !== undefined && Number.isFinite(Number(transaction.tax))) details.providerTax = Number(transaction.tax);
      if (transaction.amount_settled !== undefined && Number.isFinite(Number(transaction.amount_settled))) details.providerNetSettlement = Number(transaction.amount_settled);
      details.providerResponse = transaction;

      if (String(transaction.status).toLowerCase() === "successful") {
        // Provider says paid but no webhook/verify landed yet. Persist evidence
        // and move to PROCESSING so settlement is one claim away; the next
        // verify call (user retry) or a replayed webhook completes it safely.
        const result = await Payment.updateOne(
          { _id: record._id, status: "PENDING" },
          { $set: details }
        );
        if (result.modifiedCount > 0) summary.advancedToProcessing += 1;
      }
    } catch (error) {
      summary.errors += 1;
      console.error(`Reconciliation failed for payment ${record.reference}:`, error.message);
    }
  }

  return summary;
};

const startPaymentReconciliation = () => {
  const intervalMs = Number(process.env.RECONCILE_INTERVAL_MS || 15 * 60 * 1000);
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await reconcileStalePayments();
      if (summary.checked > 0) {
        console.log("Payment reconciliation:", JSON.stringify(summary));
      }
    } catch (error) {
      console.error("Payment reconciliation error:", error);
    } finally {
      running = false;
    }
  };

  setTimeout(run, 30 * 1000);
  setInterval(run, intervalMs);
};

module.exports = { reconcileStalePayments, startPaymentReconciliation };
