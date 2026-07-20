const express = require("express");

const authController = require("../controllers/customerAuthController");
const orderController = require("../controllers/orderController");
const customerAuth = require("../middleware/customerAuthMiddleware");

const router = express.Router();

router.post("/auth/request-otp", authController.requestOtp);
router.post("/auth/verify-otp", authController.verifyOtp);
router.get("/auth/me", customerAuth, authController.me);

router.get("/me", customerAuth, authController.me);
router.patch("/me", customerAuth, authController.updateMe);

router.get("/addresses", customerAuth, authController.listAddresses);
router.post("/addresses", customerAuth, authController.addAddress);
router.put("/addresses/:addressId", customerAuth, authController.updateAddress);
router.delete("/addresses/:addressId", customerAuth, authController.deleteAddress);

router.get("/orders", customerAuth, orderController.getMyOrders);

module.exports = router;
