require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'elgrozim1@gmail.com',
    pass: 'ndgj fxqt evtr mnbo',
  },
});

async function testEmail() {
  try {
    // First verify the configuration
    await new Promise((resolve, reject) => {
      transporter.verify((error, success) => {
        if (error) {
          console.error('Nodemailer verification failed:', error);
          reject(error);
        } else {
          console.log('Nodemailer is ready to send messages');
          resolve(success);
        }
      });
    });

    // Then send a test email
    const info = await transporter.sendMail({
      from: '"Elgro Test" <elgrozim1@gmail.com>',
      to: "elgrozim1@gmail.com",
      subject: "🧪 Test Email from Elgro System",
      html: `
        <h2>Test Email</h2>
        <p>This is a test email sent at: ${new Date().toISOString()}</p>
        <p>If you receive this, the email system is working correctly!</p>
      `
    });

    console.log('Test email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('Failed to send test email:', error);
    process.exit(1);
  }
}

testEmail();