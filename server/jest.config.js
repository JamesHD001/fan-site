module.exports = {
  testEnvironment: "node",
  rootDir: ".",
  roots: ["<rootDir>/../tests"],
  modulePaths: ["<rootDir>/node_modules"],
  setupFilesAfterEnv: ["<rootDir>/../tests/setup.js"],
  testMatch: ["<rootDir>/../tests/**/*.test.js"],
};
