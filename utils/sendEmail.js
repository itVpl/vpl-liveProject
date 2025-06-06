import nodemailer from "nodemailer";

export const sendEmail = async ({ email, subject, message }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    service: process.env.SMTP_SERVICE,
    auth: {
      user: process.env.SMTP_MAIL,
      pass: process.env.SMTP_PASS,
    },
  });
  const options = {
    from: process.env.SMTP_MAIL,
    to: email,
    subject: subject,
    html: message,
  };
  try {
    await transporter.sendMail(options, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        throw new Error("Email could not be sent");
      } else {
        console.log("Email sent successfully:", info.response);
      }
    });
  } catch (error) {
    console.error("Nodemailer error:", error);
    throw new Error("Email could not be sent");
  }
};
