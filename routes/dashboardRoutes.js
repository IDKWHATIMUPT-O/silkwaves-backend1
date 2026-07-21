const express = require("express");

const auth = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");

const controller = require("../controllers/dashboardController");

const router = express.Router();

router.get(

  "/",

  auth,

  requirePermission("dashboard", "view"),

  controller.getDashboard

);

module.exports = router;
