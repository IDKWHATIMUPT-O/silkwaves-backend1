require("dotenv").config();
const Product = require("../models/Product");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { sendEmail } = require("../services/emailService");

const orderConfirmation = require("../emailTemplates/orderConfirmation");
const { generateInvoiceBuffer } = require("../services/invoicePdf");
const Order = require("../models/Order");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create Razorpay Order
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

// Verify Payment
exports.verifyPayment = async (req, res) => {

  try {

    const {

      razorpay_order_id,

      razorpay_payment_id,

      razorpay_signature,

      orderId

    } = req.body;

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        razorpay_order_id + "|" + razorpay_payment_id
      )
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {

      return res.status(400).json({

        success: false,

        error: "Invalid payment signature"

      });

    }

    const order = await Order.findOne({

      id: orderId

    });

    if (!order) {

      return res.status(404).json({

        error: "Order not found"

      });

    }

    order.payment = "Paid";

order.paymentId = razorpay_payment_id;

order.orderId = razorpay_order_id;

// Reduce inventory

for (const item of order.items) {

  const product = await Product.findById(item.productId);

  if (!product) {

    continue;

  }

  if (product.stock < item.quantity) {

    return res.status(400).json({

      success: false,

      error: `${product.title} is out of stock`

    });

  }

  product.stock -= item.quantity;

  await product.save();

}

await order.save();

    res.json({

      success: true,

      message: "Payment verified successfully",

      order

    });
try {

  if (order.email) {

    const invoiceBuffer = await generateInvoiceBuffer(order);

    await sendEmail({

      to: order.email,

      subject: `Order Confirmation - ${order.id}`,

      html: orderConfirmation(order),

      attachments: [

        {
          filename: `${order.id}-invoice.pdf`,
          content: invoiceBuffer
        }

      ]

    });

    console.log("Order confirmation email sent with invoice.");

  }

}

catch (err) {

  console.error(

    "Email sending failed:",

    err.message

  );

}
  }

  catch (err) {

    console.error(err);

    res.status(500).json({

      error: err.message

    });

  }

};