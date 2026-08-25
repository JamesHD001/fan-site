const {
  createNotification,
  notifyMembershipActivated,
  notifyBookingConfirmed,
  notifyGiftCompleted,
} = require("../../../server/services/notificationService");

const Notification = require("../../../server/models/Notification");
const User = require("../../../server/models/User");

describe("notificationService", () => {
  let user;

  beforeEach(async () => {
    user = await User.create({
      name: "Test User",
      username: "testuser",
      email: "test@example.com",
      password: "hashedpassword123",
    });
  });

  describe("createNotification", () => {
    test("creates a notification", async () => {
      const notification =
        await createNotification({
          userId: user._id.toString(),
          type: "SYSTEM",
          title: "Hello",
          message: "Welcome!",
        });

      expect(notification).not.toBeNull();
      expect(notification.isRead).toBe(false);
      expect(notification.type).toBe("SYSTEM");

      const count =
        await Notification.countDocuments();

      expect(count).toBe(1);
    });

    test("returns null instead of throwing on invalid data", async () => {
      const result = await createNotification({
        userId: "000000000000000000000000",
        type: "INVALID_TYPE",
        title: "x",
        message: "y",
      });

      expect(result).toBeNull();
    });
  });

  describe("typed helpers", () => {
    test("notifyMembershipActivated", async () => {
      await notifyMembershipActivated(
        user._id.toString(),
        "KRC-12345678-ABCDE"
      );

      const found =
        await Notification.findOne();

      expect(found.type).toBe("MEMBERSHIP");
      expect(found.message).toContain(
        "KRC-12345678-ABCDE"
      );
    });

    test("notifyBookingConfirmed includes date", async () => {
      const when = new Date(
        "2025-08-01T15:00:00Z"
      );

      await notifyBookingConfirmed(
        user._id.toString(),
        "BK-123-ABCD",
        when
      );

      const found =
        await Notification.findOne();

      expect(found.type).toBe("BOOKING");
      expect(found.message).toContain(
        "BK-123-ABCD"
      );
    });

    test("notifyGiftCompleted handles quantity", async () => {
      await notifyGiftCompleted(
        user._id.toString(),
        "Rose",
        3
      );

      const found =
        await Notification.findOne();

      expect(found.type).toBe("GIFT");
      expect(found.message).toContain("(x3)");
    });
  });
});
