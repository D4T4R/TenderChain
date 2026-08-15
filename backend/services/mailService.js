const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Outbound email.
 *
 * When SMTP is not configured the message is logged instead of sent, so local
 * development and tests work without a mail server. That fallback is refused in
 * production: silently dropping a password reset would look like success while
 * locking the user out.
 */

let transporter;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function send({ to, subject, text, html }) {
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SMTP is not configured; refusing to silently drop outbound mail'
      );
    }
    logger.warn(
      `[mail:dev] SMTP not configured. Would have sent to ${to}: ${subject}\n${text}`
    );
    return { delivered: false, logged: true };
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || 'TenderChain <no-reply@tenderchain.local>',
    to,
    subject,
    text,
    html,
  });

  return { delivered: true };
}

function sendPasswordReset({ to, resetUrl, expiresInMinutes }) {
  const text = [
    'A password reset was requested for your TenderChain account.',
    '',
    `Reset your password: ${resetUrl}`,
    '',
    `This link can be used once and expires in ${expiresInMinutes} minutes.`,
    'If you did not request this, you can ignore this email; nothing has changed.',
  ].join('\n');

  return send({
    to,
    subject: 'Reset your TenderChain password',
    text,
  });
}

/** Test seam. */
function reset() {
  transporter = undefined;
}

module.exports = { send, sendPasswordReset, isConfigured, reset };
