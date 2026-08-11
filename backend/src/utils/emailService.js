const nodemailer = require('nodemailer');

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let cachedTransporter = null;

const hasSmtpConfig = () =>
  Boolean(process.env.EMAIL_USER) &&
  Boolean(process.env.EMAIL_PASS) &&
  (Boolean(process.env.EMAIL_SERVICE) || Boolean(process.env.EMAIL_HOST));

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
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

  cachedTransporter = nodemailer.createTransport(transportConfig);
  return cachedTransporter;
};

const resetTransporter = () => {
  cachedTransporter = null;
};

const normalizeRecipient = (email) => {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const trimmed = email.trim();
  if (!trimmed || !EMAIL_FORMAT_REGEX.test(trimmed)) {
    return null;
  }

  return trimmed;
};

const getSenderAddress = () => {
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  return `"EventSync" <${fromAddress}>`;
};

const sendEmail = async ({ to, subject, text, html, cc, bcc }) => {
  if (cc || bcc) {
    console.warn('[Email] CC/BCC are not supported for EventSync reminders and were ignored.');
  }

  const recipient = normalizeRecipient(to);
  if (!recipient) {
    return {
      status: 'skipped',
      reason: 'invalid email format',
      recipient: typeof to === 'string' ? to.trim() : to,
    };
  }

  if (process.env.EMAIL_DRY_RUN === 'true') {
    console.log('[Email] DRY RUN', { to: recipient, subject });
    return {
      status: 'sent',
      dryRun: true,
      recipient,
      messageId: 'dry-run',
    };
  }

  if (!hasSmtpConfig()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured');
    }

    console.log('[Email] Preview mode (SMTP not configured)', { to: recipient, subject });
    return {
      status: 'sent',
      preview: true,
      recipient,
      messageId: 'preview',
    };
  }

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: getSenderAddress(),
    to: recipient,
    subject,
    text,
    html,
  });

  return {
    status: 'sent',
    recipient,
    messageId: info.messageId,
    accepted: info.accepted || [recipient],
    rejected: info.rejected || [],
  };
};

module.exports = {
  sendEmail,
  normalizeRecipient,
  resetTransporter,
  hasSmtpConfig,
};
