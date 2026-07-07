const auth = require("../middleware/authMiddleware");
const express = require("express");

const controller =
require("../controllers/settingsController");

const router = express.Router();

router.get("/",controller.getSettings);

router.post( "/",auth,controller.saveSettings);

module.exports = router;