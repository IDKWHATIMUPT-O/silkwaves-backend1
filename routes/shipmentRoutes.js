const auth = require("../middleware/authMiddleware");
const express = require("express");

const controller =
require("../controllers/shipmentController");

const router = express.Router();

router.get(
  "/fetch-waybill",
  auth,
  controller.fetchWaybill
);

router.get(
  "/check-serviceability",
  auth,
  controller.checkServiceability
);

router.post(
  "/create-shipment/:orderId",
  auth,
  controller.createShipment
);

router.get(
  "/shipping-label/:orderId",
  auth,
  controller.shippingLabel
);

router.get(
  "/track-shipment/:orderId",
  auth,
  controller.trackShipment
);
router.get(
  "/shipment/:orderId",
  auth,
  controller.getShipmentDetails
);
router.post(
  "/cancel-shipment/:orderId",
  auth,
  controller.cancelShipment
);
router.post(
  "/sync-shipment/:orderId",
  auth,
  controller.syncShipmentStatus
);
router.get(
  "/public/check-serviceability",
  controller.checkServiceability
);
module.exports = router;
