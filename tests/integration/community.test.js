const request = require("supertest");

const app = require("../../server/app");

describe("Community API", () => {
  let token;
  let user;

  const registerAndLogin = async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Post Author",
        username: "postauthor",
        email: "author@example.com",
        password: "Password123",
      });

    return res.body;
  };

  beforeEach(async () => {
    const body = await registerAndLogin();

    token = body.token;
    user = body.user;
  });

  const createPost = async () => {
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "My first fan post",
        content:
          "Keanu is the kindest person in Hollywood.",
      });

    return res;
  };

  describe("POST /api/posts", () => {
    test("creates a post as PENDING", async () => {
      const res = await createPost();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(
        res.body.data.post.status
      ).toBe("PENDING");
    });

    test("requires authentication", async () => {
      const res = await request(app)
        .post("/api/posts")
        .send({ title: "x", content: "y" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/posts", () => {
    test("hides pending posts from the feed", async () => {
      await createPost();

      const res = await request(app).get(
        "/api/posts"
      );

      expect(res.status).toBe(200);
      expect(res.body.data.posts).toHaveLength(0);
    });
  });

  describe("likes and comments on approved posts", () => {
    let postId;

    beforeEach(async () => {
      // Create then approve directly via model
      const created = await createPost();
      postId = created.body.data.post._id;

      const Post =
        require("../../server/models/Post");

      await Post.findByIdAndUpdate(postId, {
        status: "APPROVED",
      });
    });

    test("toggles a like on and off", async () => {
      const likeRes = await request(app)
        .post(`/api/posts/${postId}/like`)
        .set("Authorization", `Bearer ${token}`);

      expect(likeRes.body.data.liked).toBe(true);
      expect(
        likeRes.body.data.likeCount
      ).toBe(1);

      const unlikeRes = await request(app)
        .post(`/api/posts/${postId}/like`)
        .set("Authorization", `Bearer ${token}`);

      expect(unlikeRes.body.data.liked).toBe(
        false
      );
      expect(
        unlikeRes.body.data.likeCount
      ).toBe(0);
    });

    test("adds a comment to an approved post", async () => {
      const res = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Great post!" });

      expect(res.status).toBe(201);
      expect(
        res.body.data.comment.content
      ).toBe("Great post!");
    });

    test("rejects empty comments", async () => {
      const res = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "" });

      expect(res.status).toBe(400);
    });

    test("feed shows counts and likedByMe", async () => {
      await request(app)
        .post(`/api/posts/${postId}/like`)
        .set("Authorization", `Bearer ${token}`);

      await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Nice!" });

      const res = await request(app)
        .get("/api/posts")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.posts).toHaveLength(1);

      const post = res.body.data.posts[0];

      expect(post.likeCount).toBe(1);
      expect(post.commentCount).toBe(1);
      expect(post.likedByMe).toBe(true);
    });
  });
});
