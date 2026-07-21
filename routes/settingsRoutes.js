const auth = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const express = require("express");

const controller =
require("../controllers/settingsController");

const router = express.Router();

router.get("/",controller.getSettings);

router.post( "/",auth,requirePermission("settings","edit"),controller.saveSettings);

module.exports = router;
