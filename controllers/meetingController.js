import MeetingLog from '../models/MeetingLog.js';
import moment from 'moment';

// Start Meeting
export const startMeeting = async (req, res) => {
  try {
    const { empId } = req.body;
    const today = new Date().toISOString().slice(0, 10);
    // Check if already ongoing
    const ongoing = await MeetingLog.findOne({ empId, date: today, endTime: null });
    if (ongoing) {
      return res.status(400).json({ success: false, message: 'Meeting already in progress.' });
    }
    // Create new log
    const startTime = new Date();
    const newLog = await MeetingLog.create({
      empId,
      startTime,
      date: today,
      status: 'ongoing'
    });
    res.status(200).json({ success: true, message: 'Meeting started.', meetingLogId: newLog._id, startTime, date: today });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// End Meeting
export const endMeeting = async (req, res) => {
  try {
    const { empId } = req.body;
    const today = new Date().toISOString().slice(0, 10);
    const ongoing = await MeetingLog.findOne({ empId, date: today, endTime: null });
    if (!ongoing) {
      return res.status(404).json({ success: false, message: 'No ongoing meeting found.' });
    }
    const endTime = new Date();
    const durationMs = endTime - ongoing.startTime;
    const durationSeconds = Math.floor(durationMs / 1000);
    const durationMinutes = Math.floor(durationMs / 60000);
    ongoing.endTime = endTime;
    ongoing.durationSeconds = durationSeconds;
    ongoing.durationMinutes = durationMinutes;
    ongoing.status = 'completed';
    await ongoing.save();
    res.status(200).json({
      success: true,
      message: 'Meeting ended.',
      meetingLogId: ongoing._id,
      durationSeconds,
      durationMinutes,
      endTime,
      date: today
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
