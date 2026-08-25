const { toSubunit } = require("../../../server/utils/currency");

describe("currency utils", () => {
  describe("toSubunit", () => {
    test("converts USD to cents", () => {
      expect(toSubunit(25, "USD")).toBe(2500);
    });

    test("converts NGN to kobo", () => {
      expect(toSubunit(15000.5, "NGN")).toBe(
        1500050
      );
    });

    test("handles zero amounts", () => {
      expect(toSubunit(0, "USD")).toBe(0);
    });

    test("rounds fractional subunits", () => {
      // 10.555 * 100 = 1055.5 -> rounds to 1056
      expect(toSubunit(10.555, "USD")).toBe(1056);
    });

    test("is case-insensitive on currency", () => {
      expect(toSubunit(1, "usd")).toBe(100);
      expect(toSubunit(1, "ngn")).toBe(100);
    });

    test("rejects unsupported currency", () => {
      expect(() =>
        toSubunit(10, "GBP")
      ).toThrow("Unsupported currency: GBP");
    });
  });
});
