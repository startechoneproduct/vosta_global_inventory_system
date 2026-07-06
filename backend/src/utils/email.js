const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  EMAIL_USER/EMAIL_PASS not set - emails will be logged, not sent.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
}

/**
 * Send an email. Falls back to console logging if SMTP isn't configured,
 * so the rest of the notification flow still works in development.
 */
async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();

  if (!t) {
    console.log(`📧 [EMAIL SKIPPED - no SMTP configured] To: ${to} | Subject: ${subject}`);
    return { skipped: true };
  }

  try {
    const info = await t.sendMail({
      from: `"Stacey POS" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || subject,
      html: html || `<p>${text || subject}</p>`,
    });
    return info;
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    return { error: error.message };
  }
}

module.exports = { sendEmail };
