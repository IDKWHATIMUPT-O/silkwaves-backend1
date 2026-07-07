require("dotenv").config();

const mongoose = require("mongoose");

const bcrypt = require("bcryptjs");

const Admin = require("./models/Admin");

console.log("Admin =", Admin);
console.log("typeof Admin =", typeof Admin);
console.log("findOne =", Admin.findOne);

const connectDB = require("./config/db");

async function createAdmin() {

  await connectDB();

  const exists = await Admin.findOne({

    email: "admin@silkwaves.in"

  });

  if (exists) {

    console.log("Admin already exists");

    process.exit();

  }

  const hashedPassword = await bcrypt.hash(

    "Admin@123",

    12

  );

  await Admin.create({

    name: "Silkwaves Admin",

    email: "admin@silkwaves.in",

    password: hashedPassword

  });

  console.log("✅ Admin Created");

  process.exit();

}

createAdmin();