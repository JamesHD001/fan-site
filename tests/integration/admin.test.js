const request = require("supertest");
const app = require("../../server/app");
const User = require("../../server/models/User");
const Post = require("../../server/models/Post");
const { generateToken } = require("../../server/utils/jwt");

describe("Admin API", () => {
  let admin;
  let token;

  beforeEach(async () => {
    admin = await User.create({
      name: "Admin User",
      username: "adminuser",
      email: "admin@example.com",
      password: "SuperSecret123",
      role: "ADMIN",
    });
    token = generateToken(admin);
  });

  const adminRequest = () => request(app).set("Authorization", `Bearer ${token}`);

  test("prevents an administrator from removing their own role", async () => {
    const response = await adminRequest()
      .patch(`/api/admin/users/${admin._id}`)
      .send({ role: "USER" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/cannot remove administrator privileges/i);
    expect((await User.findById(admin._id)).role).toBe("ADMIN");
  });

  test("returns dashboard statistics and revenue structure", async () => {
    const response = await adminRequest().get("/api/admin/dashboard");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.stats).toEqual(expect.objectContaining({
      totalUsers: 1,
      activeMemberships: 0,
      postsPendingApproval: 0,
    }));
    expect(response.body.data.revenue).toEqual(expect.objectContaining({
      currency: "USD",
      total: 0,
      transactions: 0,
    }));
  });

  test("moderates a pending post", async () => {
    const post = await Post.create({
      author: admin._id,
      title: "Pending post",
      content: "Awaiting administrator review.",
      status: "PENDING",
    });

    const response = await adminRequest()
      .patch(`/api/admin/posts/${post._id}/moderate`)
      .send({ status: "APPROVED" });

    expect(response.status).toBe(200);
    expect(response.body.data.post.status).toBe("APPROVED");
    expect((await Post.findById(post._id)).status).toBe("APPROVED");
  });

  test("rejects non-administrators from admin endpoints", async () => {
    const user = await User.create({
      name: "Regular User",
      username: "regularuser",
      email: "regular@example.com",
      password: "SuperSecret123",
      role: "USER",
    });

    const response = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${generateToken(user)}`);

    expect(response.status).toBe(403);
  });
});
