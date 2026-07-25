const express = require("express");
const auth = require("../middleware/authMiddleware");
const { requirePermission, requireAdminRole } = require("../middleware/permissionMiddleware");
const controller = require("../controllers/reportController");

const router = express.Router();

router.get("/", auth, requirePermission("reports", "view"), controller.getReports);
router.get("/export", auth, requireAdminRole, controller.exportFullReport);

module.exports = router;
