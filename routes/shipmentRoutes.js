const express = require("express");

const controller =
require("../controllers/shipmentController");

const router = express.Router();

router.get(
  "/fetch-waybill",
  controller.fetchWaybill
);

router.get(
  "/check-serviceability",
  controller.checkServiceability
);

router.post(
  "/create-shipment/:orderId",
  controller.createShipment
);

router.get(
  "/shipping-label/:orderId",
  controller.shippingLabel
);

module.exports = router;