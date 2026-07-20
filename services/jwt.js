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

exports.generateCustomerToken = (customer) => {

  return jwt.sign(

    {
      id: customer._id,
      phone: customer.phone,
      role: "customer"
    },

    process.env.JWT_SECRET,

    {
      expiresIn: "30d"
    }

  );

};