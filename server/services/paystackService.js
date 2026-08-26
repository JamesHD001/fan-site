const PAYSTACK_BASE_URL =
  process.env.PAYSTACK_BASE_URL || "https://api.paystack.co";

const getHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
});

const initializeTransaction = async ({
  email,
  amount,
  currency,
  reference,
  metadata,
  callbackUrl,
}) => {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  if (!Number.isInteger(Number(amount)) || Number(amount) < 0) {
    throw new Error("Paystack amount must be a non-negative integer subunit amount.");
  }

  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        email,
        amount: String(Number(amount)),
        currency,
        reference,
        metadata,
        callback_url: callbackUrl,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(
      data.message || "Paystack transaction initialization failed."
    );
  }

  return data;
};

const verifyTransaction = async (reference) => {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(
      reference
    )}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(
      data.message || "Paystack transaction verification failed."
    );
  }

  return data;
};

module.exports = {
  initializeTransaction,
  verifyTransaction,
};
