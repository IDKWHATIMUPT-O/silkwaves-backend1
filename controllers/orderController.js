const Order = require("../models/Order");
const { sendEmail } = require("../services/emailService");
const orderStatusUpdate = require("../emailTemplates/orderStatusUpdate");

// Get Orders For Logged-in Customer
exports.getMyOrders = async (req, res) => {

  try {

    const orders = await Order.find({
      phone: req.customer.phone
    }).sort({
      createdAt: -1
    });

    res.json(orders);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};

// Get All Orders
exports.getOrders = async (req, res) => {

  try {

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.payment) {
      filter.payment = req.query.payment;
    }

    if (req.query.customer) {
      filter.customer = {
        $regex: req.query.customer,
        $options: "i"
      };
    }
if (req.query.phone) {

  filter.phone = req.query.phone;

}
    const orders = await Order.find(filter).sort({
      createdAt: -1
    });

    res.json(orders);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};

// Get Single Order
exports.getOrder = async (req, res) => {

  try {

    const order = await Order.findOne({
      id: req.params.id
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    res.json(order);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};

// Create Order
exports.createOrder = async (req, res) => {

  try {

    const order = {

      id: "SW" + Date.now(),

      customer: req.body.customer,

      email: req.body.email || "",

      phone: req.body.phone,

      address: req.body.address,

      city: req.body.city,

      state: req.body.state || "",

      pincode: req.body.pincode,

      items: req.body.items || [],

      amount: req.body.amount || 0,

      payment: "Pending",

paymentStatus: "Pending",

paymentVerified: false,

paymentId: null,

razorpayOrderId: null,

      status: "Placed",

      awb: null,

      shipmentStatus: "Not Created",

      trackingId: null,

      trackingUrl: null,

      courier: "Delhivery",

      notes: req.body.notes || ""

    };

    const savedOrder = await Order.create(order);

    res.status(201).json(savedOrder);

  } catch (err) {

    res.status(400).json({
      error: "Order failed",
      details: err.message
    });

  }

};

// Update Order Status
exports.updateOrderStatus = async (req, res) => {

  try {

    const order = await Order.findOneAndUpdate(

      {
        id: req.params.id
      },

      {
        status: req.body.status
      },

      {
        new: true
      }

    );

    if (!order) {

      return res.status(404).json({
        error: "Order not found"
      });

    }

    res.json(order);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};

// Send Status Update Email (independent of the status change itself)
exports.notifyStatusChange = async (req, res) => {

  try {

    const order = await Order.findOne({
      id: req.params.id
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    if (!order.email) {
      return res.status(400).json({
        error: "This order has no email on file"
      });
    }

    await sendEmail({
      to: order.email,
      subject: `Order Update - ${order.id}`,
      html: orderStatusUpdate(order, order.status)
    });

    res.json({ success: true });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};

// Update Payment Status
exports.updatePaymentStatus = async (req, res) => {

  try {

    const order = await Order.findOneAndUpdate(

      {
        id: req.params.id
      },

      {
        payment: req.body.payment
      },

      {
        new: true
      }

    );

    if (!order) {

      return res.status(404).json({
        error: "Order not found"
      });

    }

    res.json(order);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};

// Delete Order
exports.deleteOrder = async (req, res) => {

  try {

    const order = await Order.findOneAndDelete({
      id: req.params.id
    });

    if (!order) {

      return res.status(404).json({
        error: "Order not found"
      });

    }

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};