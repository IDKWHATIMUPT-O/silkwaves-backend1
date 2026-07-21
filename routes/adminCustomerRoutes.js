const express = require("express");
const auth = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const controller = require("../controllers/adminCustomerController");

const router = express.Router();

router.get("/", auth, requirePermission("customers", "view"), controller.getCustomers);
router.get("/:id", auth, requirePermission("customers", "view"), controller.getCustomer);

module.exports = router;
