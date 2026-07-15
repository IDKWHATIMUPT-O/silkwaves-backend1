const Product = require("../models/Product");
const Order = require("../models/Order");
const Setting = require("../models/Setting");
const shipmentCreated =
require("../emailTemplates/shipmentCreated");

const {
sendEmail
} =
require("../services/emailService");
const axios = require("axios");
const qs = require("qs");

const buildShipment = require("../services/shipmentBuilder");

async function fetchWaybill() {

  const response = await axios.get(

    "https://track.delhivery.com/waybill/api/bulk/json/",

    {

      params: {

        count: 1

      },

      headers: {

        Authorization:
          `Token ${process.env.DELHIVERY_API_TOKEN}`,

        Accept: "application/json"

      }

    }

  );

  return response.data;

}

exports.fetchWaybill = async (req, res) => {

  try {

    const count = req.query.count || 1;

    const response = await axios.get(

      "https://track.delhivery.com/waybill/api/bulk/json/",

      {

        params: {

          count

        },

        headers: {

          Authorization:
            `Token ${process.env.DELHIVERY_API_TOKEN}`,

          Accept: "application/json"

        }

      }

    );

    res.json(response.data);

  }

  catch (err) {

    res.status(err.response?.status || 500).json({

      error: err.message,

      details: err.response?.data

    });

  }

};

exports.checkServiceability = async (req, res) => {

  try {

    const response = await axios.get(

      "https://track.delhivery.com/c/api/pin-codes/json/",

      {

        params: {

          filter_codes: req.query.pincode

        },

        headers: {

          Authorization:
            `Token ${process.env.DELHIVERY_API_TOKEN}`,

          "Content-Type":
            "application/json"

        }

      }

    );

    res.json(response.data);

  }

  catch (err) {

    res.status(err.response?.status || 500).json({

      error: err.message,

      details: err.response?.data

    });

  }

};

exports.createShipment = async (req, res) => {

  try {

    const order = await Order.findOne({

      id: req.params.orderId

    });

    if (!order) {

      return res.status(404).json({

        error: "Order not found"

      });

    }

    const settings = await Setting.findOne();

    if (!settings) {

      return res.status(400).json({

        error: "Company settings not configured"

      });

    }

    const awb = await fetchWaybill();

    const shipment = buildShipment(

      order,

      settings,

      awb

    );

    const body = qs.stringify({

      format: "json",

      data: JSON.stringify(shipment)

    });

    const response = await axios.post(

      "https://track.delhivery.com/api/cmu/create.json",

      body,

      {

        headers: {

          Authorization:
            `Token ${process.env.DELHIVERY_API_TOKEN}`,

          Accept: "application/json",

          "Content-Type":
            "application/x-www-form-urlencoded"

        }

      }

    );

    if (!response.data.success) {

      order.awb = awb;

      order.shipmentStatus = "Creation Failed";

      order.delhiveryResponse = response.data;

      await order.save();
try {

  if (order.email) {

    await sendEmail({

      to: order.email,

      subject: `Your order has been shipped - ${order.id}`,

      html: shipmentCreated(order)

    });

    console.log(

      "Shipment email sent."

    );

  }

}

catch(err){

  console.error(

    "Shipment email failed:",

    err.message

  );

}
    }

    order.awb = awb;

    order.shipmentStatus = "Created";

    order.delhiveryResponse = response.data;

    await order.save();

    res.json({

      success: true,

      order,

      response: response.data

    });

  }

  catch (err) {

    console.error(

      err.response?.data || err.message

    );

    res.status(500).json({

      error:
        err.response?.data || err.message

    });

  }

};

exports.shippingLabel = async (req, res) => {

  try {

    const order = await Order.findOne({

      id: req.params.orderId

    });

    if (!order) {

      return res.status(404).json({

        error: "Order not found"

      });

    }

    if (!order.awb) {

      return res.status(400).json({

        error:
          "Shipment has not been created yet"

      });

    }

    const response = await axios.get(

      "https://track.delhivery.com/api/p/packing_slip",

      {

        params: {

          wbns: order.awb,

          pdf: true,

          pdf_size: "A4"

        },

        headers: {

          Authorization:
            `Token ${process.env.DELHIVERY_API_TOKEN}`

        }

      }

    );

    res.json(response.data);

  }

  catch (err) {

    res.status(500).json({

      error:
        err.response?.data || err.message

    });

  }

};
exports.trackShipment = async (req, res) => {

  try {

    const order = await Order.findOne({
      id: req.params.orderId
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    if (!order.awb) {
      return res.status(400).json({
        error: "Shipment has not been created yet"
      });
    }

    const response = await axios.get(
      "https://track.delhivery.com/api/v1/packages/json/",
      {
        params: {
          waybill: order.awb
        },
        headers: {
          Authorization: `Token ${process.env.DELHIVERY_API_TOKEN}`
        }
      }
    );

    // Save latest response
    order.delhiveryResponse = response.data;

    // Update shipment status if available
    const shipment =
      response.data?.ShipmentData?.[0]?.Shipment;

    if (shipment?.Status?.Status) {
      order.shipmentStatus =
        shipment.Status.Status;
    }

    await order.save();

    res.json({
      success: true,
      tracking: response.data
    });

  }

  catch (err) {

    console.error(
      err.response?.data || err.message
    );

    res.status(500).json({
      error:
        err.response?.data || err.message
    });

  }

};
exports.getShipmentDetails = async (req, res) => {

  try {

    const order = await Order.findOne({
      id: req.params.orderId
    });

    if (!order) {

      return res.status(404).json({
        error: "Order not found"
      });

    }

    res.json({

      success: true,

      shipment: {

        orderId: order.id,

        customer: order.customer,

        awb: order.awb,

        shipmentStatus: order.shipmentStatus,

        trackingId: order.trackingId,

        courier: "Delhivery",

        payment: order.payment,

        amount: order.amount,

        createdAt: order.createdAt,

        delhiveryResponse: order.delhiveryResponse

      }

    });

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};
exports.cancelShipment = async (req, res) => {

  try {

    const order = await Order.findOne({
      id: req.params.orderId
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    if (!order.awb) {
      return res.status(400).json({
        error: "Shipment has not been created"
      });
    }

    const response = await axios.post(

      "https://track.delhivery.com/api/p/edit",

      {

        waybill: order.awb,

        cancellation: "true"

      },

      {

        headers: {

          Authorization: `Token ${process.env.DELHIVERY_API_TOKEN}`,

          Accept: "application/json",

          "Content-Type": "application/json"

        }

      }

    );

    order.shipmentStatus = "Cancelled";

    order.delhiveryResponse = response.data;

    await order.save();

    res.json({

      success: true,

      order,

      response: response.data

    });

  }

  catch (err) {

    res.status(err.response?.status || 500).json({

      error: err.response?.data || err.message

    });

  }

};
exports.syncShipmentStatus = async (req, res) => {

  try {

    const order = await Order.findOne({
      id: req.params.orderId
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    if (!order.awb) {
      return res.status(400).json({
        error: "Shipment not created"
      });
    }

    const response = await axios.get(

      "https://track.delhivery.com/api/v1/packages/json/",

      {

        params: {

          waybill: order.awb

        },

        headers: {

          Authorization:
            `Token ${process.env.DELHIVERY_API_TOKEN}`

        }

      }

    );

    const shipment =
      response.data?.ShipmentData?.[0]?.Shipment;

    if (shipment?.Status?.Status) {

      order.shipmentStatus =
        shipment.Status.Status;

    }

    order.delhiveryResponse =
      response.data;

    await order.save();

    res.json({

      success: true,

      shipmentStatus:
        order.shipmentStatus

    });

  }

  catch (err) {

    res.status(500).json({

      error:
        err.response?.data || err.message

    });

  }

};
console.log({
  fetchWaybill: typeof exports.fetchWaybill,
  checkServiceability: typeof exports.checkServiceability,
  createShipment: typeof exports.createShipment,
  shippingLabel: typeof exports.shippingLabel,
});