const layout = require("./layout");

module.exports = function(order, status) {

  return layout(

    "Order Status Update",

    `
    <h2>Your order status has changed</h2>
    <p>Hello <strong>${order.customer}</strong>,</p>
    <p>Your order <strong>${order.id}</strong> is now:</p>
    <p style="font-size:28px;font-weight:bold;margin:20px 0;color:#00674E;">${status}</p>
    <hr>
    <p>
      <b>Amount:</b> &#8377;${Number(order.amount).toLocaleString("en-IN")}
    </p>
    <p>Thank you for shopping with Silkwaves.</p>
    `

  );

};
