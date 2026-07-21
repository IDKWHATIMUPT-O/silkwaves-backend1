const auth = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const express = require("express");

const controller =
require("../controllers/shipmentController");

const router = express.Router();

router.get(
  "/fetch-waybill",
  auth,
  requirePermission("fulfillment", "view"),
  controller.fetchWaybill
);

router.get(
  "/check-serviceability",
  auth,
  requirePermission("fulfillment", "view"),
  controller.checkServiceability
);

router.post(
  "/create-shipment/:orderId",
  auth,
  requirePermission("fulfillment", "edit"),
  controller.createShipment
);

router.get(
  "/shipping-label/:orderId",
  auth,
  requirePermission("fulfillment", "view"),
  controller.shippingLabel
);

router.get(
  "/track-shipment/:orderId",
  auth,
  requirePermission("fulfillment", "view"),
  controller.trackShipment
);
router.get(
  "/shipment/:orderId",
  auth,
  requirePermission("fulfillment", "view"),
  controller.getShipmentDetails
);
router.post(
  "/cancel-shipment/:orderId",
  auth,
  requirePermission("fulfillment", "edit"),
  controller.cancelShipment
);
router.post(
  "/sync-shipment/:orderId",
  auth,
  requirePermission("fulfillment", "edit"),
  controller.syncShipmentStatus
);
router.get(
  "/public/check-serviceability",
  controller.checkServiceability
);
module.exports = router;
