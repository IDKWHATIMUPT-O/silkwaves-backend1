const express = require("express");
const auth = require("../middleware/authMiddleware");
const controller = require("../controllers/adminCustomerController");

const router = express.Router();

router.get("/", auth, controller.getCustomers);
router.get("/:id", auth, controller.getCustomer);

module.exports = router;
