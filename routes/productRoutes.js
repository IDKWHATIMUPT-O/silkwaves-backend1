const auth = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const express = require("express");
const multer = require("multer");

const controller =
require("../controllers/productController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage()
});

// Public
router.get(
  "/",
  controller.getProducts
);

// Protected
router.post(
  "/",
  auth,
  requirePermission("products", "edit"),
  upload.fields([
    {
      name: "coverImage",
      maxCount: 1
    },
    {
      name: "galleryImages",
      maxCount: 4
    }
  ]),
  controller.createProduct
);

// Protected
router.put(
  "/:id",
  auth,
  requirePermission("products", "edit"),
  upload.fields([
    {
      name: "coverImage",
      maxCount: 1
    },
    {
      name: "galleryImages",
      maxCount: 4
    }
  ]),
  controller.updateProduct
);

// Protected
router.delete(
  "/:id",
  auth,
  requirePermission("products", "edit"),
  controller.deleteProduct
);

module.exports = router;