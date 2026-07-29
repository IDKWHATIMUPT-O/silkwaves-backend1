const express = require("express");

const controller = require("../controllers/tallyController");
const bridgeAuth = require("../middleware/bridgeAuthMiddleware");

const router = express.Router();

router.use(bridgeAuth);

router.get("/sync/products", controller.getPendingProducts);
router.post("/sync/products/:id/ack", controller.ackProduct);

router.get("/sync/orders", controller.getPendingOrders);
router.post("/sync/orders/:id/ack", controller.ackOrder);

router.get("/customer-ledger/:phone", controller.getCustomerLedger);
router.post("/customer-ledger/:phone", controller.setCustomerLedger);

module.exports = router;
