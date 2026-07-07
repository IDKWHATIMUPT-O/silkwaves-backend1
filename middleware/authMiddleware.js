const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

module.exports = async (req, res, next) => {

  try {

    console.log("--------------------------------");
console.log("URL:", req.originalUrl);
    console.log("Authorization Header:", req.headers.authorization);

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const token = authHeader.split(" ")[1];

    console.log("Token:", JSON.stringify(token));

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    console.log("Decoded:", decoded);

    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin) {
      return res.status(401).json({
        error: "Admin not found"
      });
    }

    req.admin = admin;

    next();

  } catch (err) {

    console.error(err);

    res.status(401).json({
      error: "Invalid token"
    });

  }

};