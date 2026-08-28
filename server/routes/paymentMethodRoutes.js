const express = require("express");
const authenticate = require("../middleware/authenticate");
const {
  listPaymentMethods,
  setDefaultPaymentMethod,
  removePaymentMethod,
} = require("../controllers/paymentMethodController");

const router = express.Router();
router.use(authenticate);
router.get("/", listPaymentMethods);
router.patch("/:id/default", setDefaultPaymentMethod);
router.delete("/:id", removePaymentMethod);

module.exports = router;
