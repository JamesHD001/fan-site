// server/config/validateEnv.js
const required = [
  "MONGODB_URI",
  "JWT_SECRET",
  "PAYSTACK_SECRET_KEY",
  "PAYSTACK_PUBLIC_KEY",
  "FLUTTERWAVE_SECRET_KEY",
  "FLUTTERWAVE_PUBLIC_KEY",
  "FLUTTERWAVE_WEBHOOK_SECRET_HASH",
  "FLUTTERWAVE_NGN_PER_USD_RATE",
  "CLIENT_URL",
];

const validateEnv = () => {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
};

module.exports = validateEnv;
