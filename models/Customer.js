const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  label: {
    type: String,
    default: "Home"
  },

  name: {
    type: String,
    required: true
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

  isDefault: {
    type: Boolean,
    default: false
  }
});

const customerSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    name: {
      type: String,
      default: ""
    },

    otpHash: {
      type: String,
      default: null
    },

    otpExpiresAt: {
      type: Date,
      default: null
    },

    otpAttempts: {
      type: Number,
      default: 0
    },

    verified: {
      type: Boolean,
      default: false
    },

    addresses: {
      type: [addressSchema],
      default: []
    },

    wishlist: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product"
        }
      ],
      default: []
    },

    tallyLedgerName: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Customer", customerSchema);
