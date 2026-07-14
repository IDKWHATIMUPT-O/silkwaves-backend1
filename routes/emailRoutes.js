const express = require("express");
const router = express.Router();

const { sendEmail } = require("../services/emailService");

const orderConfirmation = require("../emailTemplates/orderConfirmation");

router.get("/test", async (req, res) => {

  const fakeOrder = {

    id: "SW123456789",

    customer: "Yogesh Khatri",

    payment: "Paid",

    amount: 12999,

    address: "28th Cross Road",

    city: "Bangalore",

    state: "Karnataka",

    pincode: "560002",

    items: [

      {

        title: "Banarasi Silk Saree",

        quantity: 1,

        price: 12999

      }

    ]

  };

  await sendEmail({

    to: "atharvfashion2020@gmail.com",

    subject: "Order Confirmation",

    html: orderConfirmation(fakeOrder)

  });

  res.json({

    success: true

  });

});

module.exports = router;