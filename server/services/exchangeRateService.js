const EXCHANGE_RATE_BASE_URL =
  "https://api.frankfurter.dev/v2";

const getUsdToNgnRate = async () => {
  const response = await fetch(
    `${EXCHANGE_RATE_BASE_URL}/rate/USD/NGN?providers=CBN`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to retrieve USD to NGN exchange rate."
    );
  }

  const data = await response.json();

  if (
    !data ||
    data.base !== "USD" ||
    data.quote !== "NGN" ||
    typeof data.rate !== "number"
  ) {
    throw new Error(
      "Invalid USD to NGN exchange rate response."
    );
  }

  return {
    rate: data.rate,
    base: data.base,
    quote: data.quote,
    date: data.date,
  };
};

module.exports = {
  getUsdToNgnRate,
};