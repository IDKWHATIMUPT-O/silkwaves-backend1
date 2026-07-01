function buildShipment(order, settings, awb) {

  return {

    shipments: [

      {

        name: order.customer,

        add: order.address,

        pin: order.pincode,

        city: order.city,

        state: order.state,

        country: "India",

        phone: order.phone,

        order: order.id,

        payment_mode:
          order.payment === "Paid"
            ? "Prepaid"
            : "COD",

        return_pin: settings.pincode,

        return_city: settings.city,

        return_phone: settings.phone,

        return_add: settings.address,

        return_state: settings.state,

        return_country: settings.country,

        products_desc:
          order.items
            .map(i => i.title)
            .join(", "),

        hsn_code: "",

        cod_amount:
          order.payment === "Paid"
            ? 0
            : order.amount,

        order_date:
          new Date().toISOString(),

        total_amount:
          order.amount,

        seller_add:
          settings.address,

        seller_name:
          settings.companyName,

        seller_inv:
          order.id,

        quantity:
          order.items.length,

        waybill:
          awb,

        shipment_width:
          settings.packageBreadth,

        shipment_height:
          settings.packageHeight,

        weight:
          settings.packageWeight,

        shipping_mode:
          "Surface",

        address_type:
          "home"

      }

    ],

    pickup_location: {

      name:
        settings.warehouseName

    }

  };

}

module.exports = buildShipment;