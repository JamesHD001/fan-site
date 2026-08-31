jest.setTimeout(120000);

jest.mock("../../../server/services/fileStorageService", () => ({
  uploadBuffer: jest.fn(),
  deleteFile: jest.fn(),
  streamFile: jest.fn(),
}));

const Payment = require("../../../server/models/Payment");
const User = require("../../../server/models/User");
const { uploadBuffer, deleteFile, streamFile } = require("../../../server/services/fileStorageService");
const { submitProof, getProof } = require("../../../server/controllers/paymentProofController");

const makeRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const makeRequest = (user, token, body = {}) => ({
  user,
  params: { token },
  body,
  protocol: "http",
  get: jest.fn(() => "example.test"),
});

const pngPayload = Buffer.from("proof-file").toString("base64");
const validBody = {
  fileType: "image/png",
  proofUrl: `data:image/png;base64,${pngPayload}`,
  originalName: "receipt.png",
};

describe("paymentProofController", () => {
  let user;
  let supportAdmin;
  let payment;

  beforeEach(async () => {
    uploadBuffer.mockReset();
    deleteFile.mockReset();
    streamFile.mockReset();
    uploadBuffer.mockResolvedValue("507f1f77bcf86cd799439011");
    user = await User.create({ name: "Proof User", username: "proofuser", email: "proof@example.com", password: "SuperSecret123" });
    supportAdmin = await User.create({ name: "Support Admin", username: "supportadmin", email: "support@example.com", password: "SuperSecret123", role: "ADMIN", isPaymentSupport: true });
    payment = await Payment.create({
      user: user._id,
      supportAdmin: supportAdmin._id,
      paymentToken: "PAY-123",
      reference: "REF-123",
      type: "MEMBERSHIP",
      amount: 2500,
      originalAmount: 2500,
      currency: "USD",
      originalCurrency: "USD",
      status: "PENDING_PAYMENT",
      provider: "INTERNAL",
      paymentMethod: "CRYPTO",
    });
  });

  test("accepts an allowed proof and moves payment to review", async () => {
    const res = makeRes();
    await submitProof(makeRequest(user, payment.paymentToken, validBody), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(uploadBuffer).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/png" }));
    const updated = await Payment.findById(payment._id);
    expect(updated.status).toBe("PROOF_SUBMITTED");
    expect(updated.proof.originalName).toBe("receipt.png");
  });

  test("rejects unsupported proof MIME types", async () => {
    const res = makeRes();
    await submitProof(makeRequest(user, payment.paymentToken, { ...validBody, fileType: "text/html", proofUrl: "data:text/html;base64,PGgxPkhlbGxvPC9oMT4=" }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/JPG, PNG, WEBP image or PDF/);
    expect(uploadBuffer).not.toHaveBeenCalled();
  });

  test("rejects proof payloads larger than five megabytes", async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 1).toString("base64");
    const res = makeRes();
    await submitProof(makeRequest(user, payment.paymentToken, { ...validBody, proofUrl: `data:image/png;base64,${oversized}` }), res);

    expect(res.statusCode).toBe(413);
    expect(uploadBuffer).not.toHaveBeenCalled();
  });

  test("replaces rejected proof state and removes the old file", async () => {
    await Payment.findByIdAndUpdate(payment._id, {
      status: "REJECTED",
      proof: { fileId: "507f1f77bcf86cd799439012", fileType: "image/png", originalName: "old.png" },
    });
    const res = makeRes();
    await submitProof(makeRequest(user, payment.paymentToken, validBody), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/Replacement payment proof/);
    expect(deleteFile).toHaveBeenCalledWith("507f1f77bcf86cd799439012");
    expect((await Payment.findById(payment._id)).status).toBe("PROOF_SUBMITTED");
  });

  test("denies proof retrieval to users who do not own the payment", async () => {
    const otherUser = await User.create({ name: "Other User", username: "otheruser", email: "other@example.com", password: "SuperSecret123" });
    await Payment.findByIdAndUpdate(payment._id, { proof: { fileId: "507f1f77bcf86cd799439011", fileType: "image/png", originalName: "receipt.png" } });
    const res = makeRes();
    await getProof({ user: otherUser, params: { id: payment._id.toString() } }, res);

    expect(res.statusCode).toBe(403);
    expect(streamFile).not.toHaveBeenCalled();
  });
});
