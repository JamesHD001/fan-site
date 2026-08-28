const express = require("express");
const authenticate = require("../middleware/authenticate");
const { listPaymentMethods, setDefaultPaymentMethod, removePaymentMethod } = require("../controllers/paymentMethodController");
const { saveCardFromPayment } = require("../controllers/paymentMethodTokenController");

const router = express.Router();
router.use(authenticate);
router.get("/", listPaymentMethods);
router.post("/cards/from-payment", saveCardFromPayment);
router.patch("/:id/default", setDefaultPaymentMethod);
router.delete("/:id", removePaymentMethod);

module.exports = router;
