const { chargeTokenizedCard } = require("./flutterwaveProvider");

const chargeSavedCard = async ({ token, email, amountMajor, reference, narration }) =>
  chargeTokenizedCard({ token, email, amountMajor, reference, narration });

const extractCardToken = (transaction = {}) =>
  transaction.embedtoken ||
  transaction.card?.token ||
  transaction.card?.embedtoken ||
  transaction.customer?.card?.token ||
  null;

const extractCardMetadata = (transaction = {}) => {
  const card = transaction.card || transaction.customer?.card || {};
  return {
    brand: card.type || card.network || null,
    last4: card.last_4digits || card.last4 || card.last_four || null,
    expiryMonth: Number(card.expiry_month) || null,
    expiryYear: Number(card.expiry_year) || null,
  };
};

module.exports = { chargeSavedCard, extractCardToken, extractCardMetadata };
