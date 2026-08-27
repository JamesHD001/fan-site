const flutterwave = require("./flutterwaveProvider");

const providers = {
  FLUTTERWAVE: flutterwave,
};

const getPaymentProvider = (provider = "FLUTTERWAVE") => {
  const normalized = String(provider).toUpperCase();
  const implementation = providers[normalized];

  if (!implementation) {
    throw new Error(`Unsupported payment provider: ${normalized}`);
  }

  return implementation;
};

module.exports = {
  getPaymentProvider,
  providers,
};
