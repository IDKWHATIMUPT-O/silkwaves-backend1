const bcrypt = require("bcryptjs");

const Admin = require("../models/Admin");

const jwtService = require("../services/jwt");

const { generateToken } = jwtService;


// Login
exports.login = async (req, res) => {

  console.log("LOGIN REQUEST RECEIVED");
  console.log(req.body);

  try {

    const { email, password } = req.body;

    const admin = await Admin.findOne({
      email: email.toLowerCase()
    });

    console.log("Admin found:", admin);

    if (!admin) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      admin.password
    );

    console.log("Password valid:", validPassword);

    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const token = generateToken(admin);

    console.log("Token generated");

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (err) {

    console.error("========== LOGIN ERROR ==========");
    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

};
// Current Logged-in Admin
exports.me = async (req, res) => {

  res.json(req.admin);

};