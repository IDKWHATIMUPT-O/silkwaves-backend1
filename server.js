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
  products.push(req.body);
  res.json({ message: "Product added", products });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});