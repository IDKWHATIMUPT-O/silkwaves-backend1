const Order = require("../models/Order");
const { generateInvoiceBuffer } = require("../services/invoicePdf");

exports.generateInvoice = async (req, res) => {

  try {

    const order = await Order.findOne({
      id: req.params.orderId
    });

    if (!order) {

      return res.status(404).json({
        error: "Order not found"
      });

    }

    const buffer = await generateInvoiceBuffer(order);

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename=${order.id}.pdf`
    );

    res.send(buffer);

  }

  catch (err) {

    console.error(err);

    res.status(500).json({

      error: err.message

    });

  }

};
