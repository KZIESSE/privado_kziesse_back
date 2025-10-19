const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure:
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
    Number(process.env.SMTP_PORT) === 465, // 465 => TLS
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

async function sendMail({ to, subject, html, text, attachments }) {
  const from = process.env.MAIL_FROM || "no-reply@example.com";
  return transporter.sendMail({ from, to, subject, html, text, attachments });
}

module.exports = { transporter, sendMail };
