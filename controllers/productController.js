const Product = require("../models/Product");

exports.getProducts = async (req, res) => {

  try {

    const products = await Product.find();

    res.json(products);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};

exports.createProduct = async (req, res) => {

  try {

    const newProduct = await Product.create({

      slug: req.body.title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]/g, ""),

      title: req.body.title,

      price: Number(req.body.price),

      stock: Number(req.body.stock || 0),

      category: req.body.category,

      description: req.body.description,

      coverImage:
        req.files?.coverImage?.[0]
          ? `data:${req.files.coverImage[0].mimetype};base64,${req.files.coverImage[0].buffer.toString("base64")}`
          : "",

      galleryImages: []

    });

    res.status(201).json(newProduct);

  }

  catch (err) {

    res.status(400).json({
      error: err.message
    });

  }

};

exports.updateProduct = async (req, res) => {

  try {

    const product = await Product.findById(req.params.id);

    if (!product) {

      return res.status(404).json({
        error: "Product not found"
      });

    }

    product.title =
      req.body.title || product.title;

    product.price =
      Number(req.body.price) || product.price;

    product.stock =
      req.body.stock !== undefined
        ? Number(req.body.stock)
        : product.stock;

    product.category =
      req.body.category || product.category;

    product.description =
      req.body.description || product.description;

    if (req.files?.coverImage?.[0]) {

      product.coverImage =
        `data:${req.files.coverImage[0].mimetype};base64,${req.files.coverImage[0].buffer.toString("base64")}`;

    }

    await product.save();

    res.json(product);

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};

exports.deleteProduct = async (req, res) => {

  try {

    const product =
      await Product.findByIdAndDelete(req.params.id);

    if (!product) {

      return res.status(404).json({
        error: "Product not found"
      });

    }

    res.json({
      deleted: true
    });

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};