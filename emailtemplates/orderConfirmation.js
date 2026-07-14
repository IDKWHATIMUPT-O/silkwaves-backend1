const layout = require("./layout");

module.exports = function(order){

const items = order.items
.map(

item=>`

<tr>

<td>

${item.title}

</td>

<td align="center">

${item.quantity}

</td>

<td align="right">

₹${Number(item.price).toLocaleString("en-IN")}

</td>

</tr>

`

)

.join("");

return layout(

"Order Confirmation",

`

<h2>

Thank you for your order ❤️

</h2>

<p>

Hello <strong>${order.customer}</strong>,

</p>

<p>

We've successfully received your order.

</p>

<hr>

<h3>

Order Details

</h3>

<p>

<b>Order ID:</b>

${order.id}

</p>

<p>

<b>Payment:</b>

${order.payment}

</p>

<table
width="100%"
cellpadding="10"
style="border-collapse:collapse;"
>

<tr
style="background:#f5f5f5;"
>

<th align="left">

Product

</th>

<th>

Qty

</th>

<th align="right">

Price

</th>

</tr>

${items}

</table>

<hr>

<h3>

Shipping Address

</h3>

<p>

${order.address}

<br>

${order.city},

${order.state}

-

${order.pincode}

</p>

<h2>

Total

₹${Number(order.amount).toLocaleString("en-IN")}

</h2>

<p>

Thank you for shopping with Silkwaves.

</p>

`

);

};