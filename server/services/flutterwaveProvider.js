const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";

const getSecretKey = () => {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error("FLUTTERWAVE_SECRET_KEY is not configured.");
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

  if (!response.ok || body.status !== "success") {
    throw new Error(body.message || `Flutterwave request failed (${response.status}).`);
  }
  return body;
};

const initializeDeposit = async ({ reference, email, name, amountMajor, currency, redirectUrl, metadata = {} }) => {
  if (!reference || !email || !amountMajor || !currency || !redirectUrl) {
    throw new Error("Missing required Flutterwave payment initialization data.");
  }

  return request("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: reference,
      amount: amountMajor,
      currency,
      redirect_url: redirectUrl,
      customer: { email, name: name || undefined },
      customizations: {
        title: "Keanu Reeves Fan Community",
        description: "Platform credit deposit",
      },
      meta: metadata,
    }),
  });
};

const verifyDeposit = async (transactionId) => {
  if (!transactionId) throw new Error("Flutterwave transaction ID is required.");
  return request(`/transactions/${encodeURIComponent(transactionId)}/verify`, { method: "GET" });
};

module.exports = { initializeDeposit, verifyDeposit };
