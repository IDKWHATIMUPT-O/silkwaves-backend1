const express = require("express");

const controller = require("../controllers/orderController");
const auth = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Customer Routes
|--------------------------------------------------------------------------
*/

// Create Order
router.post(
  "/",
  controller.createOrder
);

/*
|--------------------------------------------------------------------------
| Admin Routes (Protected)
|--------------------------------------------------------------------------
*/

// Get All Orders
router.get(
  "/",
  auth,
  requirePermission("orders", "view"),
  controller.getOrders
);

// Get Single Order
router.get(
  "/:id",
  auth,
  requirePermission("orders", "view"),
  controller.getOrder
);

// Update Order Status
router.patch(
  "/:id/status",
  auth,
  requirePermission("orders", "edit"),
  controller.updateOrderStatus
);

// Send Status Update Email
router.post(
  "/:id/notify-status",
  auth,
  requirePermission("orders", "edit"),
  controller.notifyStatusChange
);

// Update Payment Status
router.patch(
  "/:id/payment",
  auth,
  requirePermission("orders", "edit"),
  controller.updatePaymentStatus
);

// Delete Order
router.delete(
  "/:id",
  auth,
  requirePermission("orders", "edit"),
  controller.deleteOrder
);

module.exports = router;
