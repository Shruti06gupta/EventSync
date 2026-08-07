const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, text, html }) => {
  const hasSmtpConfig =
    Boolean(process.env.EMAIL_USER) &&
    Boolean(process.env.EMAIL_PASS) &&
    (Boolean(process.env.EMAIL_SERVICE) || Boolean(process.env.EMAIL_HOST));

  if (!hasSmtpConfig && process.env.NODE_ENV !== 'production') {
    console.log('OTP email preview:', { to, subject, text, html });
    return { preview: true };
  }

  const transportConfig = process.env.EMAIL_SERVICE
    ? {
        service: process.env.EMAIL_SERVICE,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      }
    : {
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      };

  const transporter = nodemailer.createTransport(transportConfig);

  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const from = `"EventSync" <${fromAddress}>`;

  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    return { preview: false, messageId: info.messageId };
  } catch (error) {
    const details = [error.code, error.response].filter(Boolean).join(' | ');
    throw new Error(details || error.message || 'Unable to send email');
  }
};

module.exports = sendEmail;
