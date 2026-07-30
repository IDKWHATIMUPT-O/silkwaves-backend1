const cloudinary = require("../services/cloudinary");
const streamifier = require("streamifier");
const Product = require("../models/Product");
const { buildWorkbook, sendWorkbook } = require("../services/excelReport");

// Upload a single image to Cloudinary
async function uploadImage(file, folder = "silkwaves/products") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });
}

// Upload multiple gallery images
async function uploadGallery(files) {
  const urls = [];

  for (const file of files) {
    const uploaded = await uploadImage(file);
    urls.push(uploaded.secure_url);
  }

  return urls;
}

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// Export products/stock (admin-only)
exports.exportProducts = async (req, res) => {
  try {
    const products = await Product.find();

    const workbook = buildWorkbook([
      {
        name: "Products & Stock",
        columns: [
          { header: "Title", key: "title", width: 30 },
          { header: "Category", key: "category", width: 18 },
          { header: "Price", key: "price", width: 12 },
          { header: "Stock", key: "stock", width: 10 },
          { header: "Inventory Value", key: "value", width: 16 },
        ],
        rows: products.map((p) => ({
          title: p.title,
          category: p.category,
          price: p.price,
          stock: p.stock,
          value: Number(p.price) * Number(p.stock),
        })),
      },
    ]);

    await sendWorkbook(res, workbook, "silkwaves-products.xlsx");
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// Create Product
exports.createProduct = async (req, res) => {
  try {
    let coverImage = "";
    let galleryImages = [];

    // Upload cover image
    if (req.files?.coverImage?.[0]) {
      const uploaded = await uploadImage(req.files.coverImage[0]);
      coverImage = uploaded.secure_url;
    }

    // Upload gallery images
    if (req.files?.galleryImages?.length) {
      galleryImages = await uploadGallery(req.files.galleryImages);
    }

    const newProduct = await Product.create({
      slug: req.body.title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]/g, ""),

      title: req.body.title,

      price: Number(req.body.price),

      compareAtPrice: req.body.compareAtPrice
        ? Number(req.body.compareAtPrice)
        : null,

      stock: Number(req.body.stock || 0),

      category: req.body.category,

      tallyGroup: req.body.tallyGroup || null,

      description: req.body.description,

      coverImage,

      galleryImages,
    });

    res.status(201).json(newProduct);
  } catch (err) {
    console.error(err);

    res.status(400).json({
      error: err.message,
    });
  }
};

// Update Product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    product.title = req.body.title || product.title;

    product.price =
      req.body.price !== undefined
        ? Number(req.body.price)
        : product.price;

    product.stock =
      req.body.stock !== undefined
        ? Number(req.body.stock)
        : product.stock;

    if (req.body.compareAtPrice !== undefined) {
      product.compareAtPrice = req.body.compareAtPrice
        ? Number(req.body.compareAtPrice)
        : null;
    }

    product.category =
      req.body.category || product.category;

    if (req.body.tallyGroup !== undefined) {
      product.tallyGroup = req.body.tallyGroup || null;
    }

    product.description =
      req.body.description || product.description;

    // Replace cover image
    if (req.files?.coverImage?.[0]) {
      const uploaded = await uploadImage(req.files.coverImage[0]);
      product.coverImage = uploaded.secure_url;
    }

    // Replace gallery images
    if (req.files?.galleryImages?.length) {
      product.galleryImages = await uploadGallery(
        req.files.galleryImages
      );
    }

    await product.save();

    res.json(product);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// Delete Product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    res.json({
      deleted: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};