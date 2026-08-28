const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireAdmin = require("../middleware/adminMiddleware");
const { requestPayment, getMyPayment, getPaymentSupport, confirmPayment, listPendingPayments } = require("../controllers/manualPaymentController");

const router = express.Router();
router.get("/support", getPaymentSupport);
router.post("/request", authenticate, requestPayment);
router.get("/mine/:token", authenticate, getMyPayment);
router.get("/admin/pending", authenticate, requireAdmin, listPendingPayments);
router.patch("/admin/:id/confirm", authenticate, requireAdmin, confirmPayment);

module.exports = router;
