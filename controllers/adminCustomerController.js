const Customer = require("../models/Customer");
const Order = require("../models/Order");
const { buildWorkbook, sendWorkbook } = require("../services/excelReport");

async function getCustomersWithStats() {

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

  return customers.map((customer) => {
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

}

// List all customers with aggregated order stats
exports.getCustomers = async (req, res) => {

  try {

    const result = await getCustomersWithStats();

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

// Export customers (admin-only)
exports.exportCustomers = async (req, res) => {

  try {

    const result = await getCustomersWithStats();

    const workbook = buildWorkbook([
      {
        name: "Customers",
        columns: [
          { header: "Name", key: "name", width: 24 },
          { header: "Phone", key: "phone", width: 16 },
          { header: "Email", key: "email", width: 26 },
          { header: "Verified", key: "verified", width: 12 },
          { header: "Addresses", key: "addressCount", width: 12 },
          { header: "Orders", key: "orderCount", width: 10 },
          { header: "Total Spent", key: "totalSpent", width: 14 },
          { header: "Joined", key: "joined", width: 16 }
        ],
        rows: result.map((c) => ({
          name: c.name,
          phone: c.phone,
          email: c.email,
          verified: c.verified ? "Yes" : "No",
          addressCount: c.addressCount,
          orderCount: c.orderCount,
          totalSpent: c.totalSpent,
          joined: new Date(c.createdAt).toLocaleDateString("en-IN")
        }))
      }
    ]);

    await sendWorkbook(res, workbook, "silkwaves-customers.xlsx");

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

};
