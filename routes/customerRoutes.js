const express = require("express");

const authController = require("../controllers/customerAuthController");
const orderController = require("../controllers/orderController");
const customerAuth = require("../middleware/customerAuthMiddleware");

const router = express.Router();

router.post("/auth/request-otp", authController.requestOtp);
router.post("/auth/verify-otp", authController.verifyOtp);
router.get("/auth/me", customerAuth, authController.me);

router.get("/orders", customerAuth, orderController.getMyOrders);

module.exports = router;
