// import nodemailer from "nodemailer";

// export const sendEmail = async ({ email, subject, message }) => {
//   const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: process.env.SMTP_PORT,
//     service: process.env.SMTP_SERVICE,
//     auth: {
//       user: process.env.SMTP_MAIL,
//       pass: process.env.SMTP_PASS,
//     },
//   });
//   const options = {
//     from: process.env.SMTP_MAIL,
//     to: email,
//     subject: subject,
//     html: message,
//   };
//   try {
//     await transporter.sendMail(options, (error, info) => {
//       if (error) {
//         console.error("Error sending email:", error);
//         throw new Error("Email could not be sent");
//       } else {
//         console.log("Email sent successfully:", info.response);
//       }
//     });
//   } catch (error) {
//     console.error("Nodemailer error:", error);
//     throw new Error("Email could not be sent");
//   }
// };


import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
dotenv.config({path: './config.env'});

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async ({ to, subject, html }) => {
  const msg = {
    to,
    from: {
      email: "it@vpower-logistics.com",
      name: "V Power Logistics"
    },
    subject,
    html
  };

  try {
    await sgMail.send(msg);
    console.log("📧 Email sent to:", to);
  } catch (error) {
    console.error("❌ SendGrid error:", error.response?.body || error.message);
  }
};
