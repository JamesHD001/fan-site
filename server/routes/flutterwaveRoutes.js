const express = require("express");
const authenticate = require("../middleware/authenticate");
const { createDeposit, verifyFlutterwaveDeposit } = require("../controllers/flutterwaveController");

const router = express.Router();
router.post("/deposits", authenticate, createDeposit);
router.post("/deposits/verify", authenticate, verifyFlutterwaveDeposit);
module.exports = router;
