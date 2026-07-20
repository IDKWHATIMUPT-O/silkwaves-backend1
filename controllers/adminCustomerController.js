const Customer = require("../models/Customer");
const Order = require("../models/Order");

// List all customers with aggregated order stats
exports.getCustomers = async (req, res) => {

  try {

    const customers = await Customer.find().sort({ createdAt: -1 });

    const stats = await Order.aggregate([
      {
        $group: {
          _id: "$phone",
          orderCount: { $sum: 1 },
          totalSpent: { $sum: "$amount" }
        }
      }
    ]);

    const statsByPhone = {};

    stats.forEach((stat) => {
      statsByPhone[stat._id] = {
        orderCount: stat.orderCount,
        totalSpent: stat.totalSpent
      };
    });

    const result = customers.map((customer) => {
      const customerStats = statsByPhone[customer.phone] || {
        orderCount: 0,
        totalSpent: 0
      };

      return {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        verified: customer.verified,
        createdAt: customer.createdAt,
        addressCount: customer.addresses.length,
        orderCount: customerStats.orderCount,
        totalSpent: customerStats.totalSpent
      };
    });

    res.json(result);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

};

// Single customer with addresses + full order history
exports.getCustomer = async (req, res) => {

  try {

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const orders = await Order.find({ phone: customer.phone }).sort({ createdAt: -1 });

    res.json({
      id: customer._id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      verified: customer.verified,
      createdAt: customer.createdAt,
      addresses: customer.addresses,
      orders
    });

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

};
