const axios = require("axios");

async function isPincodeServiceable(pincode) {

  const response = await axios.get(
    "https://track.delhivery.com/c/api/pin-codes/json/",
    {
      params: {
        filter_codes: pincode
      },
      headers: {
        Authorization: `Token ${process.env.DELHIVERY_API_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );

  return !!(
    response.data.delivery_codes &&
    response.data.delivery_codes.length > 0
  );

}

module.exports = { isPincodeServiceable };
