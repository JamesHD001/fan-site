require("dotenv").config();
const validateEnv = require("./config/validateEnv");
validateEnv();

const app = require("./app");
const connectDatabase = require("./config/database");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start server.");
    process.exit(1);
  }
};

startServer();