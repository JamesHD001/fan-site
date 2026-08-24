const bcrypt = require("bcryptjs");

const hashPassword = async (password) => {
  const saltRounds = 12;

  return bcrypt.hash(password, saltRounds);
};

const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

module.exports = {
  hashPassword,
  comparePassword,
};