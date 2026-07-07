const Order = require("../models/Order");
const Product = require("../models/Product");

exports.getDashboard = async (req, res) => {

  try {

    const orders = await Order.find();

    const products = await Product.find();

    const revenue = orders.reduce(

      (sum, order) =>

        order.payment === "Paid"

          ? sum + Number(order.amount)

          : sum,

      0

    );

    const pendingOrders = orders.filter(

      o => o.status === "Placed"

    ).length;

    const shipped = orders.filter(

      o => o.status === "Shipped"

    ).length;

    const delivered = orders.filter(

      o => o.status === "Delivered"

    ).length;

    const lowStock = products.filter(

      p => p.stock <= 5

    ).length;

    const customers = new Set(

      orders.map(o => o.phone)

    ).size;

    const recentOrders = orders

      .sort(

        (a, b) =>

          new Date(b.createdAt) -

          new Date(a.createdAt)

      )

      .slice(0, 5);
const recentProducts = [...products]
  .sort(
    (a, b) =>
      new Date(b.createdAt) -
      new Date(a.createdAt)
  )
  const productSales = {};

orders.forEach(order => {

  if (order.payment !== "Paid") return;

  order.items.forEach(item => {

    if (!productSales[item.title]) {

      productSales[item.title] = {

        title: item.title,

        quantity: 0,

        revenue: 0

      };

    }

    productSales[item.title].quantity += item.quantity;

    productSales[item.title].revenue +=

      item.price * item.quantity;

  });

});

const topProducts =

Object.values(productSales)

.sort(

(a,b)=>

b.quantity-a.quantity

)

.slice(0,5);

const revenueLast30Days = [];

for(let i=29;i>=0;i--){

const day = new Date();

day.setDate(

day.getDate()-i

);

const label =

day.toLocaleDateString(

"en-IN",

{

day:"2-digit",

month:"short"

}

);

const amount = orders

.filter(order=>{

const created=

new Date(order.createdAt);

return (

created.toDateString()

===

day.toDateString()

&&

order.payment==="Paid"

);

})

.reduce(

(sum,order)=>

sum+

Number(order.amount),

0

);

revenueLast30Days.push({

day:label,

amount

});

}
const lowStockProducts =

products

.filter(

p=>p.stock<=5

)

.sort(

(a,b)=>

a.stock-b.stock

)

.slice(0,5);
  

    res.json({

revenue,

totalOrders:orders.length,

totalProducts:products.length,

customers,

pendingOrders,

shipped,

delivered,

lowStock,

recentOrders,

recentProducts,

topProducts,

lowStockProducts,

revenueLast30Days

});

  }

  catch (err) {

    res.status(500).json({

      error: err.message

    });

  }

};