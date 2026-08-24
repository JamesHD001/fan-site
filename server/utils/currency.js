const CURRENCY_MULTIPLIERS = {
    USD: 100,
    NGN: 100,
    GHS: 100,
    ZAR: 100,
    KES: 100,
    XOF: 100,
  };
  
  const toSubunit = (amount, currency) => {
    const normalizedCurrency = currency.toUpperCase();
  
    const multiplier =
      CURRENCY_MULTIPLIERS[normalizedCurrency];
  
    if (!multiplier) {
      throw new Error(
        `Unsupported currency: ${normalizedCurrency}`
      );
    }
  
    return Math.round(amount * multiplier);
  };
  
  module.exports = {
    toSubunit,
  };