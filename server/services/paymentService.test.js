const {
  calculateNgnCustomerCharge,
  isValidPaystackAmount,
} = require("./paymentService");

describe("Paystack NGN customer fee handling", () => {
  test("accepts the exact application amount", () => {
    expect(isValidPaystackAmount(134309430, 134309430)).toBe(true);
  });

  test("accepts the application amount plus the capped ₦2,000 customer fee", () => {
    expect(calculateNgnCustomerCharge(134309430)).toBe(134509430);
    expect(isValidPaystackAmount(134309430, 134509430)).toBe(true);
  });

  test("rejects an arbitrary overpayment", () => {
    expect(isValidPaystackAmount(134309430, 134509431)).toBe(false);
    expect(isValidPaystackAmount(134309430, 134709430)).toBe(false);
  });

  test("calculates the uncapped fee correctly for smaller transactions", () => {
    // ₦10,000 = 1,000,000 kobo; fee = 1.5% + ₦100 = ₦250.
    expect(calculateNgnCustomerCharge(1_000_000)).toBe(1_025_000);
  });
});
