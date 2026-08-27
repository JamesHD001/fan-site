const paystackProvider = require("../paystackService");

const providers = {
  PAYSTACK: paystackProvider,
};

const getPaymentProvider = (name) => {
  const normalized = String(name || "").toUpperCase();
  const provider = providers[normalized];
  if (!provider) throw new Error(`Unsupported payment provider: ${normalized || "unknown"}`);
  return provider;
};

const registerPaymentProvider = (name, provider) => {
  const normalized = String(name || "").toUpperCase();
  if (!normalized || !provider) throw new Error("Payment provider name and implementation are required.");
  providers[normalized] = provider;
};

module.exports = { getPaymentProvider, registerPaymentProvider };
