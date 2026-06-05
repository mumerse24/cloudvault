const nodemailer = require('nodemailer');

const getTransporter = () => {
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = getTransporter();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'CloudVault'}" <${process.env.SMTP_FROM_EMAIL || 'no-reply@cloudvault.com'}>`,
        to,
        subject,
        text,
        html,
      });
      console.log(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error('SMTP Email send failed:', error.message);
    }
  }

  // Fallback: Console logger for development
  console.log('\n--- 📧 DEVELOPMENT EMAIL LOG ---');
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Text:\n${text}`);
  if (html) {
    console.log(`HTML:\n${html}`);
  }
  console.log('--------------------------------\n');
  return { messageId: 'dev-console-log-id' };
};

module.exports = { sendEmail };
