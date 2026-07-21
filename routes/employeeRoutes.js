const express = require("express");
const auth = require("../middleware/authMiddleware");
const { requireAdminRole } = require("../middleware/permissionMiddleware");
const controller = require("../controllers/employeeController");

const router = express.Router();

router.get("/", auth, requireAdminRole, controller.listEmployees);
router.post("/", auth, requireAdminRole, controller.createEmployee);
router.put("/:id", auth, requireAdminRole, controller.updateEmployee);
router.delete("/:id", auth, requireAdminRole, controller.deleteEmployee);

module.exports = router;
