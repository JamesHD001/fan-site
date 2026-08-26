require("dotenv").config({
  path: require("path").resolve(__dirname, "../../server/.env"),
});

const mongoose = require("mongoose");
const connectDatabase = require("../../server/config/database");
const Booking = require("../../server/models/Booking");

const syncIndexes = async () => {
  try {
    await connectDatabase();

    console.log("Synchronizing Booking indexes...");
    await Booking.syncIndexes();

    console.log("Booking indexes synchronized successfully.");
  } catch (error) {
    console.error("Index synchronization failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

syncIndexes();
