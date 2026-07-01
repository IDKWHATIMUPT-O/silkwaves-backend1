const qs = require("qs");
const buildShipment = require("./services/shipmentBuilder");
const axios = require("axios");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Razorpay =require('razorpay');
const app = express();
app.use(cors());
app.use(express.json());
const razorpay =
new Razorpay({

key_id:
process.env
.RAZORPAY_KEY_ID,

key_secret:
process.env
.RAZORPAY_KEY_SECRET

});

app.use(
express.urlencoded({
extended:true
})
);
const upload = multer({
storage: multer.memoryStorage()
});

let products = [];
let orders = [];
let settings = {

  companyName: "",

  gstNumber: "",

  email: "",

  phone: "",

  warehouseName: "",

  address: "",

  city: "",

  state: "",

  pincode: "",

  country: "India",

  packageWeight: "0.5",

  packageLength: "30",

  packageBreadth: "25",

  packageHeight: "8"

};
async function fetchWaybill() {

  const response = await axios.get(
    "https://track.delhivery.com/waybill/api/bulk/json/",
    {
      params: {
        count: 1
      },
      headers: {
        Authorization: `Token ${process.env.DELHIVERY_API_TOKEN}`,
        Accept: "application/json"
      }
    }
  );

  console.log(response.data);

  return response.data;
}
app.get("/", (req, res) => {
res.send("SILKWAVES API RUNNING");
});

app.get("/products", (req, res) => {
res.json(products);
});
app.get("/orders", (req, res) => {
res.json(orders);
});
app.get("/settings", (req, res) => {

  res.json(settings);
  });
app.get("/check-serviceability", async (req, res) => {

  console.log(process.env.DELHIVERY_API_TOKEN);

  try {

    const pincode = req.query.pincode;

    const response = await axios.get(
      "https://track.delhivery.com/c/api/pin-codes/json/",
      {
        params: {
          filter_codes: pincode
        },
        headers: {
  Authorization: `Token ${process.env.DELHIVERY_API_TOKEN}`,
  "Content-Type": "application/json"
}
      }
    );

    res.json(response.data);

  } catch (err) {

    console.log("STATUS:", err.response?.status);
    console.log("HEADERS:", err.response?.headers);
    console.log("DATA:", err.response?.data);

    res.status(err.response?.status || 500).json({
      error: err.message,
      details: err.response?.data || null
    });

  }

});
app.get("/fetch-waybill", async (req, res) => {

  try {

    const count = req.query.count || 1;

    const response = await axios.get(
      "https://track.delhivery.com/waybill/api/bulk/json/",
      {
        params: {
          count
        },
        headers: {
          Authorization: `Token ${process.env.DELHIVERY_API_TOKEN}`,
          Accept: "application/json"
        }
      }
    );

    res.json(response.data);

  } catch (err) {

    console.log("STATUS:", err.response?.status);
    console.log("DATA:", err.response?.data);

    res.status(err.response?.status || 500).json({
      error: err.message,
      details: err.response?.data
    });

  }

});
app.post("/settings", (req, res) => {

  settings = {

    ...settings,

    ...req.body

  };

  res.json({

    success: true,

    settings

  });

});
app.post(
"/create-payment",

async (
req,
res
)=>{

try{

console.log(
"BODY:",
req.body
);

const order =
await razorpay
.orders
.create({

amount:
Number(
req.body.amount
)*100,

currency:
"INR"

});

res.json(
order
);

}

catch(err){

console.log(
err
);

res
.status(400)
.json({

error:
err.message,

details:
err

});

}

}
);
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

stock:
Number(
req.body.stock || 0
),

category: req.body.category,

description: req.body.description,
stock:
Number(
req.body.stock
|| 0
),
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

  try {

    const order = {

      id: "SW" + Date.now(),

      customer: req.body.customer,

      phone: req.body.phone,

      address: req.body.address,

      city: req.body.city,

      state: req.body.state || "",

      pincode: req.body.pincode,

      items: req.body.items || [],

      amount: req.body.amount || 0,

      payment: req.body.payment || "Pending",

      status: "Placed",

      awb: null,

      shipmentStatus: "Not Created",

      trackingId: null,

      createdAt: new Date().toISOString()

    };

    orders.unshift(order);

    res.status(201).json(order);

  } catch (err) {

    res.status(400).json({

      error: "Order failed",

      details: err.message

    });

  }

});
app.put(
"/orders/:id/status",

(req,res)=>{

const order=
orders.find(
o=>
o.id===
req.params.id
);

if(
!order
){

return res
.status(404)
.json({
error:
"Order not found"
});

}

order.status=
req.body.status;

res.json(
order
);

}
);
app.put(
"/products/:id",

upload.fields([
{
name:"coverImage",
maxCount:1
},
{
name:"galleryImages",
maxCount:4
}
]),

async (req,res)=>{

try{

const id =
req.params.id;

const index =
products.findIndex(
p =>
p.id===id
);

if(index===-1){

return res
.status(404)
.json({
error:
"Product not found"
});

}

const old =
products[index];

products[index]={

...old,

title:
req.body.title
||
old.title,

price:
req.body.price
||
old.price,

stock:
req.body.stock
??
old.stock,

category:
req.body.category
||
old.category,

description:
req.body.description
||
old.description

};

res.json(
products[index]
);

}

catch(err){

res
.status(400)
.json({
error:
err.message
});

}

}
);
app.delete("/products/:id", (req, res) => {
products =
products.filter(
p => p.id !== req.params.id
);

res.json({
deleted: true
});
});
app.get("/test-awb", async (req, res) => {

  try {

    const data = await fetchWaybill();

    res.json(data);

  } catch (err) {

    res.status(500).json({
      error: err.response?.data || err.message
    });

  }

});
app.post("/create-shipment/:orderId", async (req, res) => {

  try {

    // Find the order
    const order = orders.find(
      o => o.id === req.params.orderId
    );

    if (!order) {

      return res.status(404).json({
        error: "Order not found"
      });

    }

    // Fetch one AWB
    const awb = await fetchWaybill();

    // Build payload
    const shipment = buildShipment(
      order,
      settings,
      awb
    );

    // Convert to Delhivery format
    const body = qs.stringify({

      format: "json",

      data: JSON.stringify(shipment)

    });

    // Send to Delhivery
    const response = await axios.post(

      "https://track.delhivery.com/api/cmu/create.json",

      body,

      {

        headers: {

          Authorization:
            `Token ${process.env.DELHIVERY_API_TOKEN}`,

          Accept: "application/json",

          "Content-Type":
            "application/x-www-form-urlencoded"

        }

      }

    );

    // Save AWB
    order.awb = awb;

    order.shipmentStatus = "Created";

    order.delhiveryResponse = response.data;

    res.json({

      success: true,

      awb,

      response: response.data

    });

  }

  catch (err) {

    console.error(
      err.response?.data || err.message
    );

    res.status(500).json({

      error:
        err.response?.data || err.message

    });

  }

});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Running on", PORT);
});

console.log("End of server.js");
