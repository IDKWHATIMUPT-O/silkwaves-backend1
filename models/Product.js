const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },

    slug: {
      type: String,
      required: true,
      unique: true
    },

    price: {
      type: Number,
      required: true
    },

    compareAtPrice: {
      type: Number,
      default: null
    },

    stock: {
      type: Number,
      default: 0
    },

    category: {
      type: String,
      default: ""
    },

    description: {
      type: String,
      default: ""
    },

    coverImage: {
      type: String,
      default: ""
    },

    galleryImages: {
      type: [String],
      default: []
    },

    tallyGroup: {
      type: String,
      default: null
    },

    tallyStockItemSynced: {
      type: Boolean,
      default: false
    },

    tallySyncedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Product", productSchema);