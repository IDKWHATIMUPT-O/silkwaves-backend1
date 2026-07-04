const Order = require("../models/Order");

exports.getOrders = async (req, res) => {

  try {

    const orders = await Order.find().sort({
      createdAt: -1
    });

    res.json(orders);

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};

exports.createOrder = async (req, res) => {

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

      trackingId: null

    };

    const savedOrder = await Order.create(order);

    res.status(201).json(savedOrder);

  }

  catch (err) {

    res.status(400).json({

      error: "Order failed",

      details: err.message

    });

  }

};

exports.updateOrderStatus = async (req, res) => {

  try {

    const order = await Order.findOneAndUpdate(

      { id: req.params.id },

      { status: req.body.status },

      { new: true }

    );

    if (!order) {

      return res.status(404).json({
        error: "Order not found"
      });

    }

    res.json(order);

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};