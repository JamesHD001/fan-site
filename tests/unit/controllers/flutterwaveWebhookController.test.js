const mongoose = require("mongoose");
const crypto = require("crypto");

jest.setTimeout(120000);

jest.mock("../../../server/services/providers/flutterwaveProvider", () => ({
  verifyPayment: jest.fn(),
}));

jest.mock("../../../server/services/paymentSettlementService", () => ({
  settleSuccessfulPayment: jest.fn(),
  applyProviderTransactionDetails: jest.fn(),
}));

const Payment = require("../../../server/models/Payment");
const User = require("../../../server/models/User");

// Legacy gateway coverage is retained as a regression suite for the removed
// provider boundary; current manual-payment behavior is covered separately.
const { verifyPayment } = require("../../../server/services/providers/flutterwaveProvider");
const { settleSuccessfulPayment, applyProviderTransactionDetails } = require("../../../server/services/paymentSettlementService");
const { handleFlutterwaveWebhook } = require("../../../server/controllers/flutterwaveWebhookController");

const SECRET = "test-webhook-secret";

const makeRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  send(text) { this.body = text; return this; },
});

const makeReq = (payload, { raw = false, signature = null, legacy = null } = {}) => {
  const bodyString = typeof payload === "string" ? payload : JSON.stringify(payload);
  const req = {
    headers: {},
    rawBody: bodyString,
  };
  if (raw) req.body = Buffer.from(bodyString, "utf8");
  else req.body = bodyString;
  if (signature) req.headers["flutterwave-signature"] = signature;
  if (legacy) req.headers["verif-hash"] = legacy;
  return req;
};

const sign = (body) =>
  crypto.createHmac("sha256", SECRET).update(body).digest("base64");

describe("handleFlutterwaveWebhook", () => {
  let user;
  let payment;

  beforeEach(async () => {
    process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = SECRET;
    verifyPayment.mockReset();
    settleSuccessfulPayment.mockReset();
    applyProviderTransactionDetails.mockReset();

    // Avoid real Mongo transactions (unsupported on the standalone in-memory
    // server): stub startSession with a no-op session object.
    jest.spyOn(mongoose, "startSession").mockReturnValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      inTransaction: jest.fn(() => false),
      endSession: jest.fn(),
    });

    user = await User.create({
      name: "Pay User",
      username: "payuser",
      email: "pay@example.com",
      password: "SuperSecret123",
    });

    payment = await Payment.create({
      user: user._id,
      reference: "REF-123",
      paymentToken: "PAY-123",
      supportAdmin: user._id,
      provider: "INTERNAL",
      paymentMethod: "CRYPTO",
      type: "MEMBERSHIP",
      amount: 5000,
      originalAmount: 5000,
      currency: "USD",
      originalCurrency: "USD",
      status: "PENDING_PAYMENT",
    });
  });

  afterEach(() => {
    mongoose.startSession.mockRestore();
  });

  const eventFor = (data) => ({
    event: "charge.completed",
    data,
  });

  test("rejects requests with an invalid signature", async () => {
    const payload = eventFor({ id: 123, tx_ref: "REF-123" });
    const res = makeRes();
    await handleFlutterwaveWebhook(makeReq(payload, { signature: "bad-signature" }), res);

    expect(res.statusCode).toBe(401);
    expect(settleSuccessfulPayment).not.toHaveBeenCalled();
  });

  test("rejects requests when the secret is not configured", async () => {
    delete process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
    const payload = eventFor({ id: 123, tx_ref: "REF-123" });
    const res = makeRes();
    await handleFlutterwaveWebhook(makeReq(payload, { signature: sign(JSON.stringify(payload)) }), res);

    expect(res.statusCode).toBe(401);
  });

  test("rejects malformed JSON payloads", async () => {
    const res = makeRes();
    await handleFlutterwaveWebhook(makeReq("{not json", { signature: sign("{not json") }), res);

    expect(res.statusCode).toBe(400);
  });

  test("flags currency mismatch for review without settling", async () => {
    verifyPayment.mockResolvedValue({
      data: { id: 123, tx_ref: "REF-123", status: "successful", currency: "NGN", amount: 50 },
    });

    const payload = eventFor({ id: 123, tx_ref: "REF-123" });
    const res = makeRes();
    await handleFlutterwaveWebhook(makeReq(payload, { signature: sign(JSON.stringify(payload)) }), res);

    expect(res.statusCode).toBe(200);
    const updated = await Payment.findById(payment._id);
    expect(updated.status).toBe("REQUIRES_REVIEW");
    expect(updated.metadata.reviewReason).toBe("CURRENCY_MISMATCH");
    expect(settleSuccessfulPayment).not.toHaveBeenCalled();
  });

  test("flags amount mismatch for review without settling", async () => {
    verifyPayment.mockResolvedValue({
      data: { id: 123, tx_ref: "REF-123", status: "successful", currency: "USD", amount: 99.5 },
    });

    const payload = eventFor({ id: 123, tx_ref: "REF-123" });
    const res = makeRes();
    await handleFlutterwaveWebhook(makeReq(payload, { signature: sign(JSON.stringify(payload)) }), res);

    expect(res.statusCode).toBe(200);
    const updated = await Payment.findById(payment._id);
    expect(updated.status).toBe("REQUIRES_REVIEW");
    expect(updated.metadata.reviewReason).toBe("AMOUNT_MISMATCH");
    expect(settleSuccessfulPayment).not.toHaveBeenCalled();
  });

  test("settles a successful, matching transaction", async () => {
    verifyPayment.mockResolvedValue({
      data: { id: 123, tx_ref: "REF-123", status: "successful", currency: "USD", amount: 50 },
    });
    settleSuccessfulPayment.mockResolvedValue({});

    const payload = eventFor({ id: 123, tx_ref: "REF-123" });
    const res = makeRes();
    await handleFlutterwaveWebhook(makeReq(payload, { signature: sign(JSON.stringify(payload)) }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("Webhook processed.");
    expect(applyProviderTransactionDetails).toHaveBeenCalledWith(payment, expect.objectContaining({ tx_ref: "REF-123" }));
    expect(settleSuccessfulPayment).toHaveBeenCalledTimes(1);
  });

  test("is idempotent for already processed payments", async () => {
    await Payment.findByIdAndUpdate(payment._id, { status: "SUCCESS" });
    verifyPayment.mockResolvedValue({
      data: { id: 123, tx_ref: "REF-123", status: "successful", currency: "USD", amount: 50 },
    });

    const payload = eventFor({ id: 123, tx_ref: "REF-123" });
    const res = makeRes();
    await handleFlutterwaveWebhook(makeReq(payload, { signature: sign(JSON.stringify(payload)) }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("Payment already processed.");
    expect(settleSuccessfulPayment).not.toHaveBeenCalled();
  });
});
