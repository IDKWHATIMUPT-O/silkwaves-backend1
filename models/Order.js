const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({

  productId: String,

  title: String,

  price: Number,

  quantity: Number

});

const orderSchema = new mongoose.Schema({

  id: {

    type: String,

    unique: true

  },

  customer: String,

  phone: String,

  address: String,

  city: String,

  state: String,

  pincode: String,

  amount: Number,

  payment: {

    type: String,

    default: "Pending"

  },

  status: {

    type: String,

    default: "Placed"

  },

  items: [itemSchema],

  awb: {

    type: String,

    default: null

  },

  shipmentStatus: {

    type: String,

    default: "Not Created"

  },

  trackingId: {

    type: String,

    default: null

  },

  delhiveryResponse: {

    type: Object,

    default: null

  }

},
{
  timestamps: true
});

module.exports = mongoose.model("Order", orderSchema);