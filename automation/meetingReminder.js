import mongoose from 'mongoose';
import cron from 'node-cron';
import Meeting from '../models/Meeting.js';
import { Employee } from '../models/inhouseUserModel.js';
import { sendEmail } from '../utils/sendEmail.js';

// Connect to DB if not already connected
if (mongoose.connection.readyState === 0) {
  mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
}

// Helper: Beautiful meeting email template
function meetingEmailTemplate({ name, subject, date, time, location, type }) {
  return `
    <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto;">
      <h2 style="color: #2a7ae2; text-align: center;">${type === 'reminder' ? '⏰ Meeting Reminder' : '📅 Today\'s Meeting'}</h2>
      <p style="font-size: 16px; color: #333;">Dear <b>${name}</b>,</p>
      <p style="font-size: 15px; color: #333;">You have a meeting scheduled:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #eaf1fb;"><th colspan="2" style="padding: 8px; text-align: left; font-size: 16px;">Meeting Details</th></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Subject:</td><td style="padding: 8px;">${subject}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">${date}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Time:</td><td style="padding: 8px;">${time}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Location:</td><td style="padding: 8px;">${location || 'N/A'}</td></tr>
      </table>
      <p style="font-size: 15px; color: #555;">Please be on time. Good luck for your meeting!</p>
    </div>
  `;
}

// 1. Daily at 7:00 AM: Send mail for today's meetings
cron.schedule('0 7 * * *', async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const meetings = await Meeting.find({
    meetingDate: { $gte: today, $lt: tomorrow },
    status: 'scheduled',
  }).populate('user');

  for (const meeting of meetings) {
    const user = meeting.user;
    if (user && user.email) {
      await sendEmail({
        to: user.email,
        subject: `📅 You have a meeting today: ${meeting.subject}`,
        html: meetingEmailTemplate({
          name: user.name || user.employeeName || 'User',
          subject: meeting.subject,
          date: meeting.meetingDate.toLocaleDateString(),
          time: meeting.meetingTime,
          location: meeting.location,
          type: 'today',
        })
      });
      console.log(`📧 Meeting day mail sent to ${user.email}`);
    }
  }
});

// 2. Every 10 min: Send mail for meetings 1 hour from now
cron.schedule('*/10 * * * *', async () => {
  const now = new Date();
  const plusOneHour = new Date(now.getTime() + 60 * 60 * 1000);

  // Find meetings 1 hour from now (within a 10-min window)
  const meetings = await Meeting.find({
    status: 'scheduled',
    meetingDate: {
      $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      $lte: new Date(plusOneHour.getFullYear(), plusOneHour.getMonth(), plusOneHour.getDate())
    }
  }).populate('user');

  for (const meeting of meetings) {
    // Parse meeting time
    const [hour, minute] = meeting.meetingTime.split(':').map(Number);
    const meetingDateTime = new Date(meeting.meetingDate);
    meetingDateTime.setHours(hour, minute, 0, 0);
    // If meeting is 1 hour (±5 min) from now
    const diff = meetingDateTime - plusOneHour;
    if (diff >= -5 * 60 * 1000 && diff <= 5 * 60 * 1000) {
      const user = meeting.user;
      if (user && user.email) {
        await sendEmail({
          to: user.email,
          subject: `⏰ Reminder: Your meeting is in 1 hour - ${meeting.subject}`,
          html: meetingEmailTemplate({
            name: user.name || user.employeeName || 'User',
            subject: meeting.subject,
            date: meeting.meetingDate.toLocaleDateString(),
            time: meeting.meetingTime,
            location: meeting.location,
            type: 'reminder',
          })
        });
        console.log(`⏰ 1 hour reminder sent to ${user.email}`);
      }
    }
  }
});

console.log('⏰ Meeting reminder scheduler started.'); 