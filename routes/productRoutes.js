const express = require("express");
const multer = require("multer");

const controller =
require("../controllers/productController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage()
});

router.get(
  "/",
  controller.getProducts
);

router.post(
  "/",
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

router.put(
  "/:id",
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

router.delete(
  "/:id",
  controller.deleteProduct
);

module.exports = router;