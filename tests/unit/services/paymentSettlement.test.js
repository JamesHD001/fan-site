/**
 * Unit tests for payment settlement idempotency (atomic claim) and the
 * payment reconciliation job. MongoDB is not available in this environment,
 * so mongoose is mocked at the module level.
 */
jest.mock("../../../server/models/Payment", () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
  create: jest.fn(),
  claimForSettlement: jest.fn(),
}));
jest.mock("../../../server/models/Membership", () => ({}));
jest.mock("../../../server/models/Booking", () => ({}));
jest.mock("../../../server/models/GiftTransaction", () => ({}));
jest.mock("../../../server/services/walletService", () => ({ creditWallet: jest.fn() }));
jest.mock("../../../server/services/flutterwaveProvider", () => ({ verifyDeposit: jest.fn() }));
jest.mock("../../../server/utils/membership", () => ({ calculateExpiryDate: jest.fn(), generateMembershipNumber: jest.fn() }));

const Payment = require("../../../server/models/Payment");
const { settleSuccessfulPayment } = require("../../../server/services/paymentSettlementService");
const { reconcileStalePayments } = require("../../../server/jobs/paymentReconciliation");
const { verifyDeposit } = require("../../../server/services/flutterwaveProvider");

const makeSession = () => ({});

describe("settleSuccessfulPayment idempotency", () => {
  beforeEach(() => jest.clearAllMocks());

  // findById(...).session(session) chain used by the service
  const mockFindById = (payment) => {
    Payment.findById.mockReturnValue({ session: () => Promise.resolve(payment) });
  };

  it("does not settle when another path already claimed the payment", async () => {
    const session = makeSession();
    const payment = { _id: "p1", status: "PROCESSING", type: "DEPOSIT", save: jest.fn() };

    mockFindById(payment);
    // Atomic claim loses the race: doc is already PROCESSING past the claim window
    Payment.findOneAndUpdate.mockResolvedValue(null);

    const result = await settleSuccessfulPayment({ paymentId: "p1", transaction: { id: 99 }, session });

    expect(result.alreadySettled).toBe(false);
    expect(payment.save).not.toHaveBeenCalled();
  });

  it("returns alreadySettled for a payment already marked SUCCESS", async () => {
    const payment = { _id: "p1", status: "SUCCESS", type: "DEPOSIT" };
    mockFindById(payment);

    const result = await settleSuccessfulPayment({ paymentId: "p1", transaction: {}, session: makeSession() });

    expect(result.alreadySettled).toBe(true);
    expect(Payment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("claims and settles a PENDING deposit via creditWallet", async () => {
    const { creditWallet } = require("../../../server/services/walletService");
    const payment = {
      _id: "p1",
      status: "PENDING",
      type: "DEPOSIT",
      reference: "DEP-1",
      originalAmount: 1000,
      user: "u1",
      save: jest.fn(),
    };
    mockFindById(payment);
    Payment.claimForSettlement.mockResolvedValue({ ...payment, status: "PROCESSING" });
    creditWallet.mockResolvedValue({ wallet: { _id: "w1" }, transaction: { _id: "t1" }, alreadyApplied: false });

    const result = await settleSuccessfulPayment({
      paymentId: "p1",
      transaction: { id: 55, status: "successful" },
      session: makeSession(),
    });

    expect(Payment.claimForSettlement).toHaveBeenCalledWith("p1", expect.anything());
    expect(creditWallet).toHaveBeenCalledTimes(1);
    expect(result.alreadySettled).toBe(false);
    expect(payment.status).toBe("SUCCESS");
  });
});

describe("reconcileStalePayments", () => {
  beforeEach(() => jest.clearAllMocks());

  const makeQuery = (rows) => {
    const q = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(rows),
    };
    return q;
  };

  it("abandons old PENDING payments that never reached the provider", async () => {
    const stale = [{ _id: "a", reference: "DEP-A", status: "PENDING", createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), providerResponse: null, providerTransactionId: null }];
    Payment.find.mockReturnValue(makeQuery(stale));
    Payment.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const summary = await reconcileStalePayments();

    expect(summary.abandoned).toBe(1);
    expect(Payment.updateOne).toHaveBeenCalledWith(
      { _id: "a", status: "PENDING" },
      { $set: { status: "ABANDONED" } }
    );
    expect(verifyDeposit).not.toHaveBeenCalled();
  });

  it("persists provider evidence and advances completed-but-unclaimed payments", async () => {
    const stale = [{
      _id: "b",
      reference: "DEP-B",
      status: "PENDING",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      providerResponse: { reference: "DEP-B" },
      providerTransactionId: "12345",
    }];
    Payment.find.mockReturnValue(makeQuery(stale));
    Payment.updateOne.mockResolvedValue({ modifiedCount: 1 });
    verifyDeposit.mockResolvedValue({
      data: { id: 12345, status: "successful", amount: 150000, currency: "NGN", fee: 1400, tx_ref: "DEP-B" },
    });

    const summary = await reconcileStalePayments();

    expect(summary.advancedToProcessing).toBe(1);
    expect(Payment.updateOne).toHaveBeenCalledWith(
      { _id: "b", status: "PENDING" },
      expect.objectContaining({
        $set: expect.objectContaining({
          providerTransactionId: "12345",
          providerFee: 1400,
        }),
      })
    );
  });

  it("counts provider errors without throwing", async () => {
    const stale = [{
      _id: "c", reference: "DEP-C", status: "PENDING",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      providerResponse: { reference: "DEP-C" },
      providerTransactionId: "777",
    }];
    Payment.find.mockReturnValue(makeQuery(stale));
    verifyDeposit.mockRejectedValue(new Error("provider down"));

    const summary = await reconcileStalePayments();

    expect(summary.errors).toBe(1);
  });
});
