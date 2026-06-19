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
  const newProduct = {
    ...req.body,
    id: Date.now().toString() // ✅ ADD REAL ID
  };

  products.push(newProduct);

  res.json(newProduct); // ✅ IMPORTANT: return object
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