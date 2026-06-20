const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

let products = [];

app.get("/", (req, res) => {
  res.send("SILKWAVES API RUNNING");
});

app.get("/products", (req, res) => {
  res.json(products);
});

app.post("/products", (req, res) => {
  try {
    const newProduct = {
      id: Date.now().toString(),

      title: req.body.title,
      price: req.body.price,
      category: req.body.category,
      description: req.body.description,

      // temporary image handling
      coverImage:
        "https://images.unsplash.com/photo-1583391733956-6c78276477e2",

      galleryImages: []
    };

    products.push(newProduct);

    res.status(201).json(newProduct);

  } catch (err) {
    console.error(err);

    res.status(400).json({
      error: "Failed to create product"
    });
  }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
app.delete("/products/:id", (req, res) => {
  const id = req.params.id;

  products = products.filter(p => p.id !== id);

  res.json({ message: "Deleted", id });
});