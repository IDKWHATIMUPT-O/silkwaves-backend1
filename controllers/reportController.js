const ExcelJS = require("exceljs");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const { addSheet, addChartImage, sendWorkbook } = require("../services/excelReport");

function parseDateRange(query) {

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;

  if (to) {
    to.setHours(23, 59, 59, 999);
  }

  const filter = {};

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  return { from, to, filter };

}

function countBy(list, key) {

  const counts = {};

  list.forEach((item) => {
    const value = item[key] || "Unknown";
    counts[value] = (counts[value] || 0) + 1;
  });

  return counts;

}

async function buildReportData(query) {

  const { from, to, filter } = parseDateRange(query);

  const orders = await Order.find(filter).sort({ createdAt: -1 });
  const products = await Product.find();
  const customers = await Customer.find();

  // Revenue
  const paidOrders = orders.filter((o) => o.payment === "Paid");

  const revenueTotal = paidOrders.reduce((sum, o) => sum + Number(o.amount), 0);

  const revenueByDay = {};

  paidOrders.forEach((o) => {
    const day = new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    revenueByDay[day] = (revenueByDay[day] || 0) + Number(o.amount);
  });

  const revenueTrend = Object.entries(revenueByDay)
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => new Date(a.day) - new Date(b.day));

  // Orders
  const ordersByStatus = countBy(orders, "status");
  const ordersByPayment = countBy(orders, "payment");

  // Products
  const productSales = {};

  paidOrders.forEach((order) => {
    order.items.forEach((item) => {
      if (!productSales[item.title]) {
        productSales[item.title] = { title: item.title, quantity: 0, revenue: 0 };
      }
      productSales[item.title].quantity += item.quantity;
      productSales[item.title].revenue += item.price * item.quantity;
    });
  });

  const topSellers = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const productsByCategory = countBy(products, "category");

  // Stock
  const totalInventoryValue = products.reduce((sum, p) => sum + Number(p.price) * Number(p.stock), 0);
  const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= 5).sort((a, b) => a.stock - b.stock);
  const outOfStockProducts = products.filter((p) => p.stock <= 0);

  // Customers
  const spendByPhone = {};

  orders.forEach((o) => {
    if (o.payment !== "Paid") return;
    if (!spendByPhone[o.phone]) spendByPhone[o.phone] = { phone: o.phone, name: o.customer, orderCount: 0, totalSpent: 0 };
    spendByPhone[o.phone].orderCount += 1;
    spendByPhone[o.phone].totalSpent += Number(o.amount);
  });

  const topSpenders = Object.values(spendByPhone)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);

  const newCustomersInRange = from || to
    ? customers.filter((c) => {
        const created = new Date(c.createdAt);
        if (from && created < from) return false;
        if (to && created > to) return false;
        return true;
      }).length
    : customers.length;

  // Shipment / Delhivery
  const shipmentByStatus = countBy(orders, "shipmentStatus");
  const shipmentByCourier = countBy(orders, "courier");
  const awbGeneratedCount = orders.filter((o) => !!o.awb).length;

  return {
    range: { from, to },
    revenue: {
      total: revenueTotal,
      trend: revenueTrend
    },
    orders: {
      total: orders.length,
      byStatus: ordersByStatus,
      byPayment: ordersByPayment
    },
    customers: {
      total: customers.length,
      newInRange: newCustomersInRange,
      topSpenders
    },
    products: {
      total: products.length,
      byCategory: productsByCategory,
      topSellers
    },
    stock: {
      totalInventoryValue,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      lowStockProducts: lowStockProducts.map((p) => ({ title: p.title, stock: p.stock, price: p.price })),
      outOfStockProducts: outOfStockProducts.map((p) => ({ title: p.title, price: p.price }))
    },
    shipment: {
      byStatus: shipmentByStatus,
      byCourier: shipmentByCourier,
      awbGeneratedCount
    },
    _raw: { orders, products, customers: Object.values(spendByPhone) }
  };

}

exports.getReports = async (req, res) => {

  try {

    const data = await buildReportData(req.query);

    const { _raw, ...report } = data;

    res.json(report);

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: err.message });

  }

};

exports.exportFullReport = async (req, res) => {

  try {

    const data = await buildReportData(req.query);
    const { orders, products, customers } = data._raw;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Silkwaves Admin";
    workbook.created = new Date();

    const overviewSheet = workbook.addWorksheet("Overview");

    overviewSheet.getCell("A1").value = "Silkwaves Report Overview";
    overviewSheet.getCell("A1").font = { bold: true, size: 16 };

    overviewSheet.getCell("A3").value = "Total Revenue";
    overviewSheet.getCell("B3").value = data.revenue.total;
    overviewSheet.getCell("A4").value = "Total Orders";
    overviewSheet.getCell("B4").value = data.orders.total;
    overviewSheet.getCell("A5").value = "Total Customers";
    overviewSheet.getCell("B5").value = data.customers.total;
    overviewSheet.getCell("A6").value = "Total Products";
    overviewSheet.getCell("B6").value = data.products.total;
    overviewSheet.getCell("A7").value = "Inventory Value";
    overviewSheet.getCell("B7").value = data.stock.totalInventoryValue;

    if (data.revenue.trend.length > 0) {

      await addChartImage(
        workbook,
        overviewSheet,
        {
          type: "line",
          data: {
            labels: data.revenue.trend.map((t) => t.day),
            datasets: [{ label: "Revenue", data: data.revenue.trend.map((t) => t.amount), fill: true }]
          }
        },
        { col: 0, row: 9 },
        { width: 640, height: 320 }
      );

    }

    addSheet(workbook, {
      name: "Orders",
      columns: [
        { header: "Order ID", key: "id", width: 22 },
        { header: "Customer", key: "customer", width: 24 },
        { header: "Amount", key: "amount", width: 14 },
        { header: "Payment", key: "payment", width: 14 },
        { header: "Status", key: "status", width: 14 },
        { header: "Shipment Status", key: "shipmentStatus", width: 18 },
        { header: "Courier", key: "courier", width: 14 },
        { header: "AWB", key: "awb", width: 18 },
        { header: "Date", key: "date", width: 16 }
      ],
      rows: orders.map((o) => ({
        id: o.id,
        customer: o.customer,
        amount: o.amount,
        payment: o.payment,
        status: o.status,
        shipmentStatus: o.shipmentStatus,
        courier: o.courier,
        awb: o.awb || "",
        date: new Date(o.createdAt).toLocaleDateString("en-IN")
      }))
    });

    addSheet(workbook, {
      name: "Customers",
      columns: [
        { header: "Phone", key: "phone", width: 16 },
        { header: "Name", key: "name", width: 24 },
        { header: "Orders", key: "orderCount", width: 12 },
        { header: "Total Spent", key: "totalSpent", width: 16 }
      ],
      rows: customers
    });

    addSheet(workbook, {
      name: "Products & Stock",
      columns: [
        { header: "Title", key: "title", width: 30 },
        { header: "Category", key: "category", width: 18 },
        { header: "Price", key: "price", width: 12 },
        { header: "Stock", key: "stock", width: 10 }
      ],
      rows: products.map((p) => ({
        title: p.title,
        category: p.category,
        price: p.price,
        stock: p.stock
      }))
    });

    addSheet(workbook, {
      name: "Shipment Summary",
      columns: [
        { header: "Shipment Status", key: "status", width: 22 },
        { header: "Order Count", key: "count", width: 14 }
      ],
      rows: Object.entries(data.shipment.byStatus).map(([status, count]) => ({ status, count }))
    });

    await sendWorkbook(res, workbook, "silkwaves-report.xlsx");

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: err.message });

  }

};
