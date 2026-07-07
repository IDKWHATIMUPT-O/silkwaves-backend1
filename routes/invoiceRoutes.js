console.log("Invoice routes loaded");
const express = require("express");

const auth = require("../middleware/authMiddleware");

const controller = require("../controllers/invoiceController");

const router = express.Router();

router.get(

  "/:orderId",

  controller.generateInvoice

);

module.exports = router;