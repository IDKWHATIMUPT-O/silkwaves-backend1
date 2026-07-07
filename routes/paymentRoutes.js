const express = require("express");

const controller =
require("../controllers/paymentController");

const auth =
require("../middleware/authMiddleware");

const router = express.Router();

// Customer
router.post(
  "/create-payment",
  controller.createPayment
);

router.post(
  "/verify-payment",
  controller.verifyPayment
);

module.exports = router;