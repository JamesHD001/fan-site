process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret";

const mongoose = require("mongoose");
const {
  MongoMemoryServer,
} = require("mongodb-memory-server");

let mongoServer;

/*
 * Global setup: spin up an in-memory MongoDB
 * for the whole test run.
 */
jest.setTimeout(120000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      // Pin version so the binary is downloaded once
      // and cached for subsequent test runs.
      storageEngine: "wiredTiger",
    },
    binary: {
      version: "7.0.14",
    },
  });

  await mongoose.connect(
    mongoServer.getUri(),
    { dbName: "fan-site-test" }
  );
});

/*
 * Clean all collections between tests
 * so tests stay independent.
 */
afterEach(async () => {
  const collections =
    mongoose.connection.collections;

  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

/*
 * Tear down after all tests.
 */
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
