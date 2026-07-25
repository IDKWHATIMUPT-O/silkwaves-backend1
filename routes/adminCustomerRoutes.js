const express = require("express");
const auth = require("../middleware/authMiddleware");
const { requirePermission, requireAdminRole } = require("../middleware/permissionMiddleware");
const controller = require("../controllers/adminCustomerController");

const router = express.Router();

router.get("/export", auth, requireAdminRole, controller.exportCustomers);
router.get("/", auth, requirePermission("customers", "view"), controller.getCustomers);
router.get("/:id", auth, requirePermission("customers", "view"), controller.getCustomer);

module.exports = router;
