require("dotenv").config();
const authRoutes =require("./routes/authRoutes");
const productRoutes =require("./routes/productRoutes");
const orderRoutes =require("./routes/orderRoutes");
const settingsRoutes =require("./routes/settingsRoutes");
const shipmentRoutes =require("./routes/shipmentRoutes");
const paymentRoutes =require("./routes/paymentRoutes");
const Order = require("./models/Order");
const Setting = require("./models/Setting");
const Product = require("./models/Product");
const PORT = process.env.PORT || 3000;
const connectDB = require("./config/db");
const qs = require("qs");
const buildShipment = require("./services/shipmentBuilder");
const axios = require("axios");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Razorpay = require("razorpay");
const app = express();
const invoiceRoutes = require("./routes/invoiceRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const emailRoutes = require("./routes/emailRoutes");
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/setting", settingsRoutes);
app.use(paymentRoutes);
app.use(shipmentRoutes);
app.use("/auth", authRoutes);
app.use("/invoices", invoiceRoutes);
app.get("/test", (req, res) => {res.send("ok");});
app.use("/email", emailRoutes);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const upload = multer({
  storage: multer.memoryStorage()
});

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

connectDB()
  .then(() => {
    console.log("About to start Express...");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database startup failed:");
    console.error(err);
  });
