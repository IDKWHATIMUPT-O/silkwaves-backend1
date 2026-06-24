const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();

app.use(cors());

// DO NOT use express.json for file uploads

app.use(
express.urlencoded({
extended: true
})
);

const upload = multer({
storage: multer.memoryStorage()
});

let products = [];
let orders = [];

app.get("/", (req, res) => {
res.send("SILKWAVES API RUNNING");
});

app.get("/products", (req, res) => {
res.json(products);
});
app.get("/orders", (req, res) => {
res.json(orders);
});
app.post("/orders", (req, res) => {

try{

const order={

id:
"SW"+
Date.now(),

customer:
req.body.customer,

items:
req.body.items,

amount:
req.body.amount,

payment:
req.body.payment
|| "Pending",

status:
"Placed",

createdAt:
new Date()

};

orders.unshift(
order
);

res.status(201)
.json(order);

}

catch{

res.status(400)
.json({
error:
"Order failed"
});

}

});
app.post(
"/products",
upload.fields([
{ name: "coverImage", maxCount: 1 },
{ name: "galleryImages", maxCount: 4 }
]),
(req, res) => {
try {
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

    coverImage:
req.files?.coverImage?.[0]
? `data:${req.files.coverImage[0].mimetype};base64,${req.files.coverImage[0].buffer.toString("base64")}`
: "",
    galleryImages: []
  };

  products.push(newProduct);

  res.status(201).json(newProduct);

} catch (err) {
  res.status(400).json({
    error: err.message
  });
}


}
);
app.post("/orders", (req, res) => {

try{

const order={

id:
"SW"+Date.now(),

customer:
req.body.customer,

items:
req.body.items,

amount:
req.body.amount,

payment:
req.body.payment ||
"Pending",

status:
"Placed"

};

orders.unshift(order);

res
.status(201)
.json(order);

}

catch{

res
.status(400)
.json({
error:
"Order failed"
});

}

});
app.delete("/products/:id", (req, res) => {
products =
products.filter(
p => p.id !== req.params.id
);

res.json({
deleted: true
});
});

const PORT =
process.env.PORT || 3000;

app.listen(PORT, () => {
console.log(
"Running on",
PORT
);
});
