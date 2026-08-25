const { getUsdToNgnRate } = require("./exchangeRateService");

/*
 * Converts a USD price into the NGN amount
 * to charge via Paystack.
 *
 * Returns:
 *  - ngnAmount:   amount in NGN (normal units)
 *  - exchangeRate: USD → NGN rate used
 */
const convertUsdToNgn = async (usdAmount) => {
  const rateData = await getUsdToNgnRate();

  const ngnAmount =
    Math.round(usdAmount * rateData.rate * 100) / 100;

  return {
    ngnAmount,
    exchangeRate: rateData.rate,
    rateDate: rateData.date,
  };
};

module.exports = {
  convertUsdToNgn,
};
