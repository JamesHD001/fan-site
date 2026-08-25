const { getUsdToNgnRate } = require("./exchangeRateService");

const USD_MINOR_UNIT = 100;
const NGN_MINOR_UNIT = 100;

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

module.exports = {
  convertUsdToNgn,
};
