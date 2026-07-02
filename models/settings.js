const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({

  companyName: {
    type: String,
    default: ""
  },

  gstNumber: {
    type: String,
    default: ""
  },

  email: {
    type: String,
    default: ""
  },

  phone: {
    type: String,
    default: ""
  },

  warehouseName: {
    type: String,
    default: ""
  },

  address: {
    type: String,
    default: ""
  },

  city: {
    type: String,
    default: ""
  },

  state: {
    type: String,
    default: ""
  },

  pincode: {
    type: String,
    default: ""
  },

  country: {
    type: String,
    default: "India"
  },

  packageWeight: {
    type: String,
    default: "0.5"
  },

  packageLength: {
    type: String,
    default: "30"
  },

  packageBreadth: {
    type: String,
    default: "25"
  },

  packageHeight: {
    type: String,
    default: "8"
  }

});

module.exports = mongoose.model(
  "Settings",
  settingsSchema
);