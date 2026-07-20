const layout = require("./layout");

module.exports = function(otp) {

  return layout(

    "Your Login Code",

    `
    <h2>Your Silkwaves login code</h2>
    <p>Use the code below to sign in. It expires in 5 minutes.</p>
    <p style="font-size:36px;font-weight:bold;letter-spacing:8px;margin:24px 0;">${otp}</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
    `

  );

};
