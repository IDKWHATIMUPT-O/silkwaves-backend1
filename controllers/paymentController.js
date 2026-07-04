require("dotenv").config();
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.createPayment = async (req, res) => {

  try {

    const order = await razorpay.orders.create({

      amount: Number(req.body.amount) * 100,

      currency: "INR"

    });

    res.json(order);

  }

  catch (err) {

    console.log(err);

    res.status(400).json({

      error: err.message,

      details: err

    });

  }

};