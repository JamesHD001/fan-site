const { getUsdToNgnRate } = require("./exchangeRateService");

const USD_MINOR_UNIT = 100;
const NGN_MINOR_UNIT = 100;

// Current Paystack Nigeria local-transaction pricing.
// Paystack can optionally pass this fee to the customer from the dashboard.
const NGN_LOCAL_FEE_RATE = 0.015;
const NGN_LOCAL_FLAT_FEE = 10000; // NGN 100 in kobo
const NGN_LOCAL_FEE_CAP = 200000; // NGN 2,000 in kobo

/*
 * Converts a USD price stored in minor units into the NGN amount
 * to charge via Paystack, also stored in minor units.
 *
 * Example:
 *   3500 USD minor units = $35.00
 *   rate = 1500 NGN / USD
 *   result = 5,250,000 NGN minor units = ₦52,500.00
 */
const convertUsdToNgn = async (usdAmountMinor) => {
  if (!Number.isInteger(usdAmountMinor) || usdAmountMinor < 0) {
    throw new Error(
      "USD amount must be a non-negative integer minor-unit amount."
    );
  }

  const rateData = await getUsdToNgnRate();

  const usdMajorAmount = usdAmountMinor / USD_MINOR_UNIT;
  const ngnMajorAmount = usdMajorAmount * rateData.rate;
  const ngnAmountMinor = Math.round(
    ngnMajorAmount * NGN_MINOR_UNIT
  );

  return {
    ngnAmountMinor,
    exchangeRate: rateData.rate,
    rateDate: rateData.date,
  };
};

/*
 * Calculates the amount Paystack may charge when the merchant has
 * enabled "Pass fees to customers" for Nigerian local transactions.
 *
 * This is intentionally separate from convertUsdToNgn(): the membership
 * price remains the amount the application is selling, while this helper
 * models Paystack's optional customer-paid transaction fee.
 */
const calculateNgnCustomerCharge = (amountMinor) => {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("NGN amount must be a positive integer minor-unit amount.");
  }

  const fee = Math.min(
    Math.round(amountMinor * NGN_LOCAL_FEE_RATE) + NGN_LOCAL_FLAT_FEE,
    NGN_LOCAL_FEE_CAP
  );

  return amountMinor + fee;
};

const isValidPaystackAmount = (expectedAmountMinor, actualAmountMinor) => {
  if (
    !Number.isInteger(expectedAmountMinor) ||
    !Number.isInteger(actualAmountMinor)
  ) {
    return false;
  }

  if (actualAmountMinor === expectedAmountMinor) {
    return true;
  }

  // Paystack may add its local NGN transaction fee when the merchant has
  // enabled customer-paid fees in the dashboard. Accept only the exact
  // documented fee amount; arbitrary overpayment is still rejected.
  return (
    actualAmountMinor ===
    calculateNgnCustomerCharge(expectedAmountMinor)
  );
};

module.exports = {
  convertUsdToNgn,
  calculateNgnCustomerCharge,
  isValidPaystackAmount,
};
