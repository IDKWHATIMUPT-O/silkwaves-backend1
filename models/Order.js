const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  productId: String,
  title: String,
  price: Number,
  quantity: Number,
  coverImage: String
});

const orderSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true
    },

    customer: {
      type: String,
      required: true
    },

    email: {
      type: String,
      default: ""
    },

    phone: {
      type: String,
      required: true
    },

    address: {
      type: String,
      required: true
    },

    city: {
      type: String,
      required: true
    },

    state: {
      type: String,
      required: true
    },

    pincode: {
      type: String,
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    payment: {
      type: String,
      enum: [
        "Pending",
        "Paid",
        "Failed",
        "Refunded"
      ],
      default: "Pending"
    },

    paymentId: {
      type: String,
      default: null
    },
paymentStatus: {
  type: String,
  default: "Pending"
},

paymentVerified: {
  type: Boolean,
  default: false
},

razorpayOrderId: {
  type: String,
  default: null
},

    orderId: {
      type: String,
      default: null
    },

    status: {
      type: String,
      enum: [
        "Placed",
        "Confirmed",
        "Packed",
        "Shipped",
        "Delivered",
        "Cancelled",
        "Returned"
      ],
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

    trackingUrl: {
      type: String,
      default: null
    },

    courier: {
      type: String,
      default: "Delhivery"
    },

    delhiveryResponse: {
      type: Object,
      default: null
    },

    notes: {
      type: String,
      default: ""
    },

    tallyInvoiceSynced: {
      type: Boolean,
      default: false
    },

    tallyVoucherNumber: {
      type: String,
      default: null
    },

    tallySyncedAt: {
      type: Date,
      default: null
    },

    invoiceFileUrl: {
      type: String,
      default: null
    }

  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Order", orderSchema);