const express = require("express");

const controller =
require("../controllers/paymentController");

const router = express.Router();

router.post(
  "/create-payment",
  controller.createPayment
);

module.exports = router;