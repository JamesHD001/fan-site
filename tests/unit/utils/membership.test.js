const {
  generateMembershipNumber,
  calculateExpiryDate,
} = require("../../../server/utils/membership");

describe("membership utils", () => {
  describe("generateMembershipNumber", () => {
    test("matches KRC-########-XXXXX format", () => {
      const number =
        generateMembershipNumber();

      expect(number).toMatch(
        /^KRC-\d{8}-[A-Z0-9]{5}$/
      );
    });

    test("generates unique numbers", () => {
      const numbers = new Set();

      for (let i = 0; i < 50; i++) {
        numbers.add(generateMembershipNumber());
      }

      // Extremely unlikely to collide
      expect(numbers.size).toBeGreaterThan(45);
    });
  });

  describe("calculateExpiryDate", () => {
    const start = new Date(
      "2025-01-15T10:00:00Z"
    );

    test("adds days for DAY unit", () => {
      const expiry = calculateExpiryDate(start, {
        duration: 7,
        durationUnit: "DAY",
      });

      expect(expiry.toISOString()).toBe(
        "2025-01-22T10:00:00.000Z"
      );
    });

    test("adds months for MONTH unit", () => {
      const expiry = calculateExpiryDate(start, {
        duration: 3,
        durationUnit: "MONTH",
      });

      expect(expiry.toISOString()).toBe(
        "2025-04-15T10:00:00.000Z"
      );
    });

    test("adds years for YEAR unit", () => {
      const expiry = calculateExpiryDate(start, {
        duration: 1,
        durationUnit: "YEAR",
      });

      expect(expiry.toISOString()).toBe(
        "2026-01-15T10:00:00.000Z"
      );
    });

    test("does not mutate the start date", () => {
      const original = new Date(start);

      calculateExpiryDate(start, {
        duration: 1,
        durationUnit: "YEAR",
      });

      expect(start.getTime()).toBe(
        original.getTime()
      );
    });

    test("throws on unsupported unit", () => {
      expect(() =>
        calculateExpiryDate(start, {
          duration: 1,
          durationUnit: "WEEK",
        })
      ).toThrow(
        "Unsupported duration unit: WEEK"
      );
    });
  });
});
