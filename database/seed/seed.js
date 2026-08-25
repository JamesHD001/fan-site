require("dotenv").config({
  path: require("path").resolve(__dirname, "../../server/.env"),
});

const mongoose = require("mongoose");

const connectDatabase = require("../../server/config/database");

const Celebrity = require("../../server/models/Celebrity");
const MembershipPlan = require("../../server/models/MembershipPlan");
const MeetingType = require("../../server/models/MeetingType");
const Gift = require("../../server/models/Gift");
const User = require("../../server/models/User");

const { hashPassword } = require("../../server/utils/password");

const celebrityData = require("./data/celebrity");
const membershipData = require("./data/memberships");
const meetingData = require("./data/meetings");
const giftData = require("./data/gifts");

const seedDatabase = async () => {
  try {
    console.log("Connecting to database...");

    await connectDatabase();

    console.log("MongoDB ping successful.");

    console.log("\nClearing existing catalog data...");

    await Celebrity.deleteMany({});
    await MembershipPlan.deleteMany({});
    await MeetingType.deleteMany({});
    await Gift.deleteMany({});

    console.log("Existing catalog data cleared.");

    const celebrity = await Celebrity.create(celebrityData);

    await MembershipPlan.insertMany(membershipData);
    await MeetingType.insertMany(meetingData);
    await Gift.insertMany(giftData);

    console.log(`Created celebrity: ${celebrity.name}`);
    console.log(
      `Created ${membershipData.length} membership plans.`
    );
    console.log(
      `Created ${meetingData.length} meeting types.`
    );
    console.log(
      `Created ${giftData.length} gifts.`
    );

    /*
     * Seed the admin account.
     * Credentials come from .env with safe defaults.
     */
    const adminEmail = (
      process.env.ADMIN_EMAIL || "admin@fancommunity.com"
    ).toLowerCase();

    const adminUsername =
      process.env.ADMIN_USERNAME || "admin";

    const existingAdmin = await User.findOne({
      email: adminEmail,
    });

    if (existingAdmin) {
      console.log(
        `Admin user already exists: ${adminEmail}`
      );
    } else {
      const hashedPassword = await hashPassword(
        process.env.ADMIN_PASSWORD || "ChangeMe123!"
      );

      await User.create({
        name: "Platform Admin",
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
        isVerified: true,
      });

      console.log(
        `Created admin user: ${adminEmail}`
      );
    }

    console.log("\nDatabase seeding completed successfully.");
  } catch (error) {
    console.error("\nDatabase seeding failed.");
    console.error("Error:", error.message);

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedDatabase();