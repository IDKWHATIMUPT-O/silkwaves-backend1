const mongoose = require("mongoose");

const sectionPermission = {
  view: {
    type: Boolean,
    default: false
  },
  edit: {
    type: Boolean,
    default: false
  }
};

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["admin", "employee"],
      default: "admin"
    },

    permissions: {
      dashboard: sectionPermission,
      orders: sectionPermission,
      fulfillment: sectionPermission,
      products: sectionPermission,
      customers: sectionPermission,
      settings: sectionPermission,
      reports: sectionPermission
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Admin", adminSchema);