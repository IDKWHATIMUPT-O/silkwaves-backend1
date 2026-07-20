const axios = require("axios");

async function sendEmail({
  to,
  subject,
  html,
  attachments = []
}) {

  const payload = {
    sender: {
      email: process.env.EMAIL_FROM
    },
    to: [
      {
        email: to
      }
    ],
    subject,
    htmlContent: html
  };

  if (attachments.length > 0) {
    payload.attachment = attachments.map((file) => ({
      name: file.filename,
      content: Buffer.isBuffer(file.content)
        ? file.content.toString("base64")
        : file.content
    }));
  }

  return axios.post(
    "https://api.brevo.com/v3/smtp/email",
    payload,
    {
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    }
  );

}

module.exports = {

  sendEmail

};
