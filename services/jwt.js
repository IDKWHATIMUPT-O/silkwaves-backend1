const jwt = require("jsonwebtoken");

exports.generateToken = (admin) => {

  return jwt.sign(

    {
      id: admin._id,
      email: admin.email,
      role: admin.role
    },

    process.env.JWT_SECRET,

    {
      expiresIn: "7d"
    }

  );

};