const express = require("express");

const controller = require("../controllers/orderController");
const auth = require("../middleware/authMiddleware");

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
  controller.getOrders
);

// Get Single Order
router.get(
  "/:id",
  auth,
  controller.getOrder
);

// Update Order Status
router.patch(
  "/:id/status",
  auth,
  controller.updateOrderStatus
);

// Send Status Update Email
router.post(
  "/:id/notify-status",
  auth,
  controller.notifyStatusChange
);

// Update Payment Status
router.patch(
  "/:id/payment",
  auth,
  controller.updatePaymentStatus
);

// Delete Order
router.delete(
  "/:id",
  auth,
  controller.deleteOrder
);

module.exports = router;