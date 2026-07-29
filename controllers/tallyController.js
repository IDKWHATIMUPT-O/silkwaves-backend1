const Product = require("../models/Product");
const Order = require("../models/Order");
const Customer = require("../models/Customer");

exports.getPendingProducts = async (req, res) => {
  const products = await Product.find({});

  const pending = products.filter(
    (p) => !p.tallyStockItemSynced || !p.tallySyncedAt || p.updatedAt > p.tallySyncedAt
  );

  res.json({
    products: pending.map((p) => ({
      id: p._id,
      title: p.title,
      price: p.price,
      stock: p.stock,
      updatedAt: p.updatedAt
    }))
  });
};

exports.ackProduct = async (req, res) => {
  const { success } = req.body;

  if (success) {
    await Product.findByIdAndUpdate(
      req.params.id,
      {
        tallyStockItemSynced: true,
        tallySyncedAt: new Date()
      },
      { timestamps: false }
    );
  }

  res.json({ ok: true });
};

exports.getPendingOrders = async (req, res) => {
  const orders = await Order.find({
    payment: "Paid",
    tallyInvoiceSynced: false
  });

  const phones = [...new Set(orders.map((o) => o.phone))];
  const customers = await Customer.find({ phone: { $in: phones } });
  const ledgerByPhone = new Map(
    customers.map((c) => [c.phone, c.tallyLedgerName || null])
  );

  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      customer: o.customer,
      phone: o.phone,
      email: o.email,
      state: o.state,
      address: o.address,
      city: o.city,
      pincode: o.pincode,
      amount: o.amount,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({
        productId: i.productId,
        title: i.title,
        price: i.price,
        quantity: i.quantity
      })),
      existingTallyLedgerName: ledgerByPhone.get(o.phone) || null
    }))
  });
};

exports.ackOrder = async (req, res) => {
  const { success, tallyVoucherNumber } = req.body;

  if (success) {
    await Order.findOneAndUpdate(
      { id: req.params.id },
      {
        tallyInvoiceSynced: true,
        tallyVoucherNumber: tallyVoucherNumber || null,
        tallySyncedAt: new Date()
      }
    );
  }

  res.json({ ok: true });
};

exports.getCustomerLedger = async (req, res) => {
  const customer = await Customer.findOne({ phone: req.params.phone });

  if (!customer || !customer.tallyLedgerName) {
    return res.json({ exists: false });
  }

  res.json({ exists: true, tallyLedgerName: customer.tallyLedgerName });
};

exports.setCustomerLedger = async (req, res) => {
  const { tallyLedgerName } = req.body;

  if (!tallyLedgerName) {
    return res.status(400).json({ error: "tallyLedgerName is required" });
  }

  await Customer.findOneAndUpdate(
    { phone: req.params.phone },
    {
      $setOnInsert: { phone: req.params.phone, email: `${req.params.phone}@guest.silkwaves` },
      $set: { tallyLedgerName }
    },
    { upsert: true }
  );

  res.json({ ok: true });
};
