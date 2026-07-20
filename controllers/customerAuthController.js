const Customer = require("../models/Customer");
const { generateCustomerToken } = require("../services/jwt");
const { generateOtp, hashOtp, compareOtp, OTP_TTL_MS, MAX_ATTEMPTS } = require("../services/otp");
const { sendEmail } = require("../services/emailService");
const otpEmail = require("../emailTemplates/otpEmail");

// Request OTP (find-or-create customer, email them a code)
// NOTE: delivered by email for now since Indian DLT sender/template
// registration for SMS isn't done yet. Swap to Brevo SMS here later.
exports.requestOtp = async (req, res) => {

  try {

    const { phone, email } = req.body;

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        error: "Please provide a valid 10-digit phone number"
      });
    }

    let customer = await Customer.findOne({ phone });

    if (!customer) {

      if (!email) {
        return res.status(400).json({
          error: "Email is required for first-time login"
        });
      }

      customer = new Customer({ phone, email });

    }

    const otp = generateOtp();

    customer.otpHash = await hashOtp(otp);
    customer.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    customer.otpAttempts = 0;

    await customer.save();

    await sendEmail({
      to: customer.email,
      subject: "Your Silkwaves login code",
      html: otpEmail(otp)
    });

    const maskedEmail = customer.email.replace(
      /^(.{2}).+(@.+)$/,
      "$1***$2"
    );

    res.json({
      success: true,
      message: "OTP sent",
      emailHint: maskedEmail
    });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: err.message });

  }

};

// Verify OTP and issue a customer JWT
exports.verifyOtp = async (req, res) => {

  try {

    const { phone, otp } = req.body;

    const customer = await Customer.findOne({ phone });

    if (!customer || !customer.otpHash || !customer.otpExpiresAt) {
      return res.status(400).json({ error: "No OTP requested for this number" });
    }

    if (customer.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: "OTP expired, please request a new one" });
    }

    if (customer.otpAttempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: "Too many attempts, please request a new OTP" });
    }

    const isValid = await compareOtp(otp, customer.otpHash);

    if (!isValid) {
      customer.otpAttempts += 1;
      await customer.save();
      return res.status(400).json({ error: "Invalid OTP" });
    }

    customer.verified = true;
    customer.otpHash = null;
    customer.otpExpiresAt = null;
    customer.otpAttempts = 0;

    await customer.save();

    const token = generateCustomerToken(customer);

    res.json({
      success: true,
      token,
      customer: {
        id: customer._id,
        phone: customer.phone,
        email: customer.email,
        name: customer.name
      }
    });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: err.message });

  }

};

// Current logged-in customer
exports.me = async (req, res) => {

  res.json(req.customer);

};
