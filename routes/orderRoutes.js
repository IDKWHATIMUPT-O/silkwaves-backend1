const express = require("express");

const controller =
require("../controllers/orderController");

const router = express.Router();

router.get(
  "/",
  controller.getOrders
);

router.post(
  "/",
  controller.createOrder
);

router.put(
  "/:id/status",
  controller.updateOrderStatus
);

module.exports = router;