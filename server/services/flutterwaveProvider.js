const crypto = require("crypto");

const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";

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

// Retrieves the provider fee quote where supported. Fees are accounting data;
// they must never be used to reduce the verified customer payment amount.
const getTransactionFee = async ({ amount, currency = "NGN", paymentType = "card", cardFirstSix }) => {
  const params = new URLSearchParams({ amount: String(amount), currency, payment_type: paymentType });
  if (cardFirstSix) params.set("card_first_6digits", String(cardFirstSix));
  return request(`/transactions/fee?${params.toString()}`, { method: "GET" });
};

module.exports = { initializeDeposit, verifyDeposit, getTransactionFee };
