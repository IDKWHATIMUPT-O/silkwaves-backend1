const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail({
  to,
  subject,
  html,
  attachments = []
}) {

  return transporter.sendMail({

    from: process.env.EMAIL_FROM,

    to,

    subject,

    html,

    attachments

  });

}

module.exports = {

  sendEmail

};