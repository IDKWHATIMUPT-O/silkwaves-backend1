const express = require("express");

const controller =
require("../controllers/settingsController");

const router = express.Router();

router.get(
  "/",
  controller.getSettings
);

router.post(
  "/",
  controller.saveSettings
);

module.exports = router;