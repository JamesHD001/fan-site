const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";

const getSecretKey = () => {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) {
    throw new Error("FLUTTERWAVE_SECRET_KEY is not configured.");
  }
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

  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.status === "error") {
    const message = body.message || `Flutterwave request failed (${response.status}).`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.providerResponse = body;
    throw error;
  }

  return body;
};

const initializePayment = async ({
  reference,
  amount,
  currency = "NGN",
  email,
  name,
  phone,
  redirectUrl,
  title = "Keanu Reeves Fan Community",
  description = "Platform payment",
  metadata = {},
}) => {
  if (!reference || !email || !Number.isInteger(amount) || amount <= 0) {
    throw new Error("reference, email and a positive integer amount are required.");
  }

  return request("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: reference,
      amount: amount / 100,
      currency: currency.toUpperCase(),
      redirect_url: redirectUrl,
      payment_options: "card,banktransfer,ussd",
      customer: {
        email,
        name: name || undefined,
        phonenumber: phone || undefined,
      },
      customizations: {
        title,
        description,
      },
      meta: metadata,
    }),
  });
};

const verifyPayment = async (transactionId) => {
  if (!transactionId) {
    throw new Error("Flutterwave transaction ID is required.");
  }

  return request(`/transactions/${encodeURIComponent(transactionId)}/verify`, {
    method: "GET",
  });
};

const verifyPaymentByReference = async (reference) => {
  if (!reference) {
    throw new Error("Flutterwave payment reference is required.");
  }

  return request(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
    method: "GET",
  });
};

const isSuccessfulTransaction = (transaction) => {
  if (!transaction) return false;
  return (
    transaction.status === "successful" &&
    transaction.processor_response?.toLowerCase?.().includes("approved") !== false
  );
};

const isMatchingTransaction = ({ transaction, reference, amount, currency }) => {
  if (!transaction) return false;

  const actualReference = transaction.tx_ref || transaction.reference;
  const actualAmountMinor = Math.round(Number(transaction.amount) * 100);
  const actualCurrency = String(transaction.currency || "").toUpperCase();

  return (
    actualReference === reference &&
    actualAmountMinor === Number(amount) &&
    actualCurrency === String(currency).toUpperCase()
  );
};

const verifyWebhookHash = (receivedHash) => {
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  return Boolean(secretHash && receivedHash && receivedHash === secretHash);
};

module.exports = {
  initializePayment,
  verifyPayment,
  verifyPaymentByReference,
  isSuccessfulTransaction,
  isMatchingTransaction,
  verifyWebhookHash,
};
