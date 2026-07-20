const bcrypt = require("bcryptjs");

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

async function compareOtp(otp, hash) {
  if (!hash) return false;
  return bcrypt.compare(otp, hash);
}

module.exports = {
  generateOtp,
  hashOtp,
  compareOtp,
  OTP_TTL_MS,
  MAX_ATTEMPTS
};
