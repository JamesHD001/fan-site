const request = require("supertest");

const app = require("../../server/app");
const User = require("../../server/models/User");

describe("Auth API", () => {
  const validUser = {
    name: "Jane Fan",
    username: "janefan",
    email: "jane@example.com",
    password: "SuperSecret123",
  };

  describe("POST /api/auth/register", () => {
    test("registers a new user", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(
        "jane@example.com"
      );
      // Password must never be returned
      expect(
        res.body.user.password
      ).toBeUndefined();
    });

    test("rejects duplicate email or username", async () => {
      await request(app)
        .post("/api/auth/register")
        .send(validUser);

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          ...validUser,
          email: "other@example.com",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await request(app)
        .post("/api/auth/register")
        .send(validUser);
    });

    test("logs in with correct credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "jane@example.com",
          password: "SuperSecret123",
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe(
        "janefan"
      );
    });

    test("rejects wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "jane@example.com",
          password: "WrongPassword1",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("rejects unknown email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "ghost@example.com",
          password: "Whatever123",
        });

      expect(res.status).toBe(401);
    });

    test("rejects disabled accounts", async () => {
      await User.findOneAndUpdate(
        { email: "jane@example.com" },
        { isActive: false }
      );

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "jane@example.com",
          password: "SuperSecret123",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/auth/me", () => {
    let token;

    beforeEach(async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(validUser);

      token = res.body.token;
    });

    test("returns current user with valid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(
        "jane@example.com"
      );
    });

    test("rejects missing token", async () => {
      const res = await request(app).get(
        "/api/auth/me"
      );

      expect(res.status).toBe(401);
    });

    test("rejects invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          "Bearer not-a-real-token"
        );

      expect(res.status).toBe(401);
    });
  });
});
