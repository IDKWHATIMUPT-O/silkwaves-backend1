const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const streamifier = require("streamifier");

const app = express();

app.use(cors());
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({
  storage: multer.memoryStorage()
});

let products = [];

app.get("/", (req, res) => {
  res.send("SILKWAVES API RUNNING");
});

app.get("/products", (req, res) => {
  res.json(products);
});

app.post(
  "/products",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 4 }
  ]),
  async (req, res) => {
    try {
      async function uploadToCloudinary(file) {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "silkwaves"
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            }
          );

          streamifier
            .createReadStream(file.buffer)
            .pipe(stream);
        });
      }

      let coverImage = "";

      if (req.files?.coverImage?.[0]) {
        coverImage = await uploadToCloudinary(
          req.files.coverImage[0]
        );
      }

      const galleryImages = [];

      if (req.files?.galleryImages) {
        for (const image of req.files.galleryImages) {
          const uploaded =
            await uploadToCloudinary(image);

          galleryImages.push(uploaded);
        }
      }

      const newProduct = {
        id: Date.now().toString(),

        slug: req.body.title
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^\w-]/g, ""),

        title: req.body.title,
        price: req.body.price,
        category: req.body.category,
        description: req.body.description,

        coverImage,
        galleryImages
      };

      products.push(newProduct);

      res.status(201).json(newProduct);

    } catch (err) {
      console.error(err);

      res.status(400).json({
        error: err.message
      });
    }
  }
);

app.delete("/products/:id", (req, res) => {
  const id = req.params.id;

  products = products.filter(
    (p) => p.id !== id
  );

  res.json({
    message: "Deleted",
    id
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});