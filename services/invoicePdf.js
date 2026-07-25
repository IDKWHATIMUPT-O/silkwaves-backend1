const PDFDocument = require("pdfkit");

function generateInvoiceBuffer(order) {

  return new Promise((resolve, reject) => {

    const doc = new PDFDocument({
      size: "A4",
      margin: 50
    });

    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // -----------------------
    // Header
    // -----------------------

    doc
      .fontSize(24)
      .text("SILKWAVES", {
        align: "center"
      });

    doc.moveDown();

    doc
      .fontSize(18)
      .text("TAX INVOICE", {
        align: "center"
      });

    doc.moveDown(2);

    // -----------------------
    // Invoice Details
    // -----------------------

    doc.fontSize(12);

    doc.text(`Invoice No : INV-${order.id}`);

    doc.text(`Order No   : ${order.id}`);

    doc.text(
      `Date       : ${new Date(order.createdAt).toLocaleDateString()}`
    );

    doc.moveDown();

    // -----------------------
    // Customer
    // -----------------------

    doc
      .fontSize(14)
      .text("Bill To");

    doc.fontSize(12);

    doc.text(order.customer);

    doc.text(order.phone);

    doc.text(order.address);

    doc.text(
      `${order.city}, ${order.state}`
    );

    doc.text(order.pincode);

    doc.moveDown();

    // -----------------------
    // Items
    // -----------------------

    doc.fontSize(14).text("Items");

    doc.moveDown(0.5);

    order.items.forEach(item => {

      doc.fontSize(12);

      doc.text(

        `${item.title}

Qty: ${item.quantity}

₹${item.price}

Total: ₹${item.price * item.quantity}`

      );

      doc.moveDown();

    });

    // -----------------------
    // Total
    // -----------------------

    doc.moveDown();

    doc.fontSize(14);

    doc.text(

      `Grand Total : ₹${order.amount}`,

      {

        align: "right"

      }

    );

    doc.moveDown(2);

    doc.fontSize(12);

    doc.text(

      "Payment : " + order.payment

    );

    doc.moveDown();

    doc.text(

      "Thank you for shopping with Silkwaves.",

      {

        align: "center"

      }

    );

    doc.end();

  });

}

module.exports = { generateInvoiceBuffer };
