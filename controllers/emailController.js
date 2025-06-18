import { sendEmail } from "../utils/sendEmail.js";

export const sendTestMail = async (req, res) => {
  await sendEmail({
    to: "harshpathaksmt@gmail.com",
    subject: "Daily Attendance Status",
    text: "Dear Employee, your attendance for today is marked as Present ✅",
  });

  res.status(200).json({ success: true, message: "Test email sent" });
};


