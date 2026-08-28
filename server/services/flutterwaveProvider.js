const crypto = require("crypto");

const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";

// In-process USD/NGN rate cache: { value: number|null, fetchedAt: number }
const rateCache = { value: null, fetchedAt: 0 };

const getSecretKey = () => {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error("FLUTTERWAVE_SECRET_KEY is not configured.");
  return key;
};

const getPublicKey = () => {
  const key = process.env.FLUTTERWAVE_PUBLIC_KEY;
  if (!key) throw new Error("FLUTTERWAVE_PUBLIC_KEY is not configured.");
  return key;
};

const request = async (path, options = {}) => {
  const response = await fetch(`${FLUTTERWAVE_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let body;
  try { body = await response.json(); }
  catch { throw new Error(`Flutterwave returned an invalid response (${response.status}).`); }
  if (!response.ok || body.status !== "success") throw new Error(body.message || `Flutterwave request failed (${response.status}).`);
  return body;
};

const createPayloadHash = ({ amount, currency, email, reference }) => {
  const hashedSecret = crypto.createHash("sha256").update(getSecretKey(), "utf8").digest("hex");
  return crypto.createHash("sha256").update(`${amount}${currency}${email}${reference}${hashedSecret}`, "utf8").digest("hex");
};

/**
 * Fetch Flutterwave's supported USD -> NGN reference rate.
 *
 * This is deliberately described as a provider reference rate, not a live
 * market quote. Flutterwave's transfer-rates endpoint is the source used for
 * the platform conversion and the resulting rate is locked on each payment.
 *
 * Returns both the rate and the timestamp actually associated with the cached
 * value so the payment record can preserve an auditable FX snapshot.
 */
const getUsdToNgnRate = async () => {
  const TTL_MS = Number(process.env.FX_RATE_CACHE_TTL_MS || 5 * 60 * 1000);
  const now = Date.now();
  if (rateCache.value !== null && now - rateCache.fetchedAt < TTL_MS) {
    return { rate: rateCache.value, fetchedAt: new Date(rateCache.fetchedAt) };
  }

  const params = new URLSearchParams({
    amount: "100000",
    destination_currency: "NGN",
    source_currency: "USD",
  });

  let response;
  try {
    response = await request(`/transfers/rates?${params.toString()}`, {
      method: "GET",
      signal: AbortSignal.timeout(Number(process.env.FX_RATE_TIMEOUT_MS || 8000)),
    });
  } catch (error) {
    const maxStaleMs = Number(process.env.FX_RATE_MAX_STALE_MS || 24 * 60 * 60 * 1000);
    if (rateCache.value !== null && now - rateCache.fetchedAt < maxStaleMs) {
      console.warn("Flutterwave rate fetch failed; serving cached rate.", error.message);
      return { rate: rateCache.value, fetchedAt: new Date(rateCache.fetchedAt), stale: true };
    }
    throw error;
  }

  const rate = Number(response.data?.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Flutterwave returned an invalid USD/NGN exchange rate.");
  }

  rateCache.value = rate;
  rateCache.fetchedAt = Date.now();
  return { rate, fetchedAt: new Date(rateCache.fetchedAt), stale: false };
};

const initializeDeposit = ({ reference, email, name, amountMajor, currency = "NGN", metadata = {} }) => {
  if (!reference || !email || !Number.isFinite(Number(amountMajor)) || Number(amountMajor) <= 0 || !currency) {
    throw new Error("Missing required Flutterwave payment initialization data.");
  }
  return {
    publicKey: getPublicKey(), reference, amount: amountMajor, currency,
    paymentOptions: "card, banktransfer, ussd",
    payloadHash: createPayloadHash({ amount: amountMajor, currency, email, reference }),
    customer: { email, name: name || undefined }, metadata,
  };
};

const verifyDeposit = async (transactionId) => {
  if (!transactionId) throw new Error("Flutterwave transaction ID is required.");
  return request(`/transactions/${encodeURIComponent(transactionId)}/verify`, { method: "GET" });
};

const getTransactionFee = async ({ amount, currency = "NGN", paymentType = "card", cardFirstSix }) => {
  const params = new URLSearchParams({ amount: String(amount), currency, payment_type: paymentType });
  if (cardFirstSix) params.set("card_first_6digits", String(cardFirstSix));
  return request(`/transactions/fee?${params.toString()}`, { method: "GET" });
};

module.exports = { initializeDeposit, verifyDeposit, getTransactionFee, getUsdToNgnRate };
