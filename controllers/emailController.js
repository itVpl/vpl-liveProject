import { sendEmail } from "../utils/sendEmail.js";
import emailClient from '../utils/emailClient.js';

export const sendTestMail = async (req, res) => {
  await sendEmail({
    to: "harshpathaksmt@gmail.com",
    subject: "Daily Attendance Status",
    text: "Dear Employee, your attendance for today is marked as Present ✅",
  });

  res.status(200).json({ success: true, message: "Test email sent" });
};

export const fetchInbox = async (req, res) => {
  try {
    const emails = await emailClient.fetchInbox(req.query.limit);
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const fetchEmailByUid = async (req, res) => {
  try {
    const email = await emailClient.fetchEmailByUid(req.params.uid);
    res.json(email);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const sendMail = async (req, res) => {
  try {
    const info = await emailClient.sendMail(req.body);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const sendReply = async (req, res) => {
  try {
    const info = await emailClient.sendReply(req.body);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteEmail = async (req, res) => {
  try {
    await emailClient.deleteEmail(req.params.uid);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const saveDraft = async (req, res) => {
  try {
    const info = await emailClient.saveDraft(req.body);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


