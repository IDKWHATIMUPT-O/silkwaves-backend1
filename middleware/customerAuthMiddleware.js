const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");

module.exports = async (req, res, next) => {

  try {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "customer") {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const customer = await Customer.findById(decoded.id).select("-otpHash");

    if (!customer) {
      return res.status(401).json({
        error: "Customer not found"
      });
    }

    req.customer = customer;

    next();

  } catch (err) {

    res.status(401).json({
      error: "Invalid token"
    });

  }

};
