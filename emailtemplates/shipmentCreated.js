const layout = require("./layout");

module.exports = function (order) {

  return layout(

    "Shipment Created",

    `

<h2>

🚚 Your order is on its way!

</h2>

<p>

Hello <strong>${order.customer}</strong>,

</p>

<p>

Great news! We've packed your order and handed it over to our delivery partner.

</p>

<hr>

<h3>

Shipment Details

</h3>

<p>

<b>Order ID:</b>

${order.id}

</p>

<p>

<b>Courier:</b>

${order.courier || "Delhivery"}

</p>

<p>

<b>AWB Number:</b>

${order.awb}

</p>

<p>

<b>Status:</b>

${order.shipmentStatus}

</p>

<br>

<a

href="https://www.delhivery.com/track-v2/package/${order.awb}"

style="
background:#00674E;
color:white;
padding:14px 24px;
text-decoration:none;
border-radius:8px;
display:inline-block;
font-weight:bold;
"

>

Track Shipment

</a>

`

  );

};