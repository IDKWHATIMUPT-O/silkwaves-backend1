const Order = require("../models/Order");
const Setting = require("../models/Setting");

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

      return res.status(400).json({

        success: false,

        awb,

        response: response.data

      });

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
console.log({
  fetchWaybill: typeof exports.fetchWaybill,
  checkServiceability: typeof exports.checkServiceability,
  createShipment: typeof exports.createShipment,
  shippingLabel: typeof exports.shippingLabel,
});