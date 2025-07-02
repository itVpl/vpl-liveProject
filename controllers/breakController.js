import BreakLog from '../models/BreakLog.js';
import { Employee } from '../models/inhouseUserModel.js';
import moment from 'moment';
import { sendEmail } from '../utils/sendEmail.js';

const MAX_BREAK_MINUTES = 60;

// Start or Resume Break
export const startBreak = async (req, res) => {
  try {
    const user = req.user;
    console.log("🔥 req.user in startBreak:", user); // Debug 1

    const { empId: requestedEmpId } = req.body;
    const today = moment().format('YYYY-MM-DD');

    const empId = (requestedEmpId && (user.role === 'admin' || user.role === 'superadmin'))
      ? requestedEmpId
      : user.empId;

    console.log("🆔 Final empId used for break:", empId); // Debug 2

    const ongoing = await BreakLog.findOne({ empId, endTime: null });
    if (ongoing) {
      return res.status(400).json({ success: false, message: 'Break already in progress.' });
    }

    const todayBreaks = await BreakLog.find({ empId, date: today, endTime: { $exists: true } });
    const totalUsed = todayBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
    const remaining = MAX_BREAK_MINUTES - totalUsed;

    if (remaining <= 0) {
      return res.status(400).json({ success: false, message: 'Daily break limit reached (60 minutes).' });
    }

    const startTime = new Date();
    const newBreak = await BreakLog.create({
      empId,
      breakType: 'Break',
      startTime,
      date: today
    });

    res.status(200).json({
      success: true,
      message: 'Break started successfully.',
      empId,
      breakId: newBreak._id,
      startTime,
      remainingMinutes: remaining,
      maxLimit: MAX_BREAK_MINUTES
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// End Break
export const endBreak = async (req, res) => {
  try {
    const user = req.user;
    const { empId: requestedEmpId } = req.body || {};

    const empId = (requestedEmpId && (user.role === 'admin' || user.role === 'superadmin'))
      ? requestedEmpId
      : user.empId;

    const ongoing = await BreakLog.findOne({ empId, endTime: null }).sort({ startTime: -1 });
    if (!ongoing) {
      return res.status(404).json({ success: false, message: 'No ongoing break found.' });
    }

    const endTime = new Date();
    const duration = Math.floor((endTime - ongoing.startTime) / 60000);
    const isOverdue = duration > MAX_BREAK_MINUTES;

    ongoing.endTime = endTime;
    ongoing.durationMinutes = duration;
    ongoing.overdue = isOverdue;
    await ongoing.save();

    if (isOverdue) {
      await sendOverdueNotification(empId, duration);
    }

    // 🔄 Calculate new remaining time
    const today = moment().format('YYYY-MM-DD');
    const todayBreaks = await BreakLog.find({ empId, date: today, endTime: { $exists: true } });
    const totalUsed = todayBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
    const remaining = Math.max(MAX_BREAK_MINUTES - totalUsed, 0);

    res.status(200).json({
      success: true,
      message: `Break ended successfully. ${isOverdue ? 'Break exceeded 60 minutes!' : ''}`,
      empId,
      breakId: ongoing._id,
      duration,
      overdue: isOverdue,
      endTime,
      remainingMinutes: remaining,
      maxLimit: MAX_BREAK_MINUTES
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// My Break History
export const getMyBreakHistory = async (req, res) => {
  try {
    const breaks = await BreakLog.find({ empId: req.user.empId }).sort({ startTime: -1 }).limit(50);
    res.status(200).json({ success: true, breaks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// All Overdue Breaks (HR/Admin)
export const getOverdueBreaks = async (req, res) => {
  try {
    const breaks = await BreakLog.find({ overdue: true }).sort({ startTime: -1 });
    res.status(200).json({ success: true, overdueBreaks: breaks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// All Breaks (HR/Admin)
export const getAllBreaks = async (req, res) => {
  try {
    const breaks = await BreakLog.find({}).sort({ startTime: -1 });
    res.status(200).json({ success: true, breaks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Periodic Overdue Checker (for CRON)
export const checkOverdueBreaks = async () => {
  try {
    const now = new Date();
    const ongoingBreaks = await BreakLog.find({ endTime: null });

    for (const breakLog of ongoingBreaks) {
      const duration = Math.floor((now - breakLog.startTime) / 60000);
      if (duration > MAX_BREAK_MINUTES && !breakLog.overdue) {
        await sendOverdueNotification(breakLog.empId, duration);
        breakLog.overdue = true;
        breakLog.durationMinutes = duration;
        breakLog.endTime = now;
        await breakLog.save();
      }
    }
  } catch (err) {
    console.error('❌ Error checking overdue breaks:', err);
  }
};

// Email Alert
const sendOverdueNotification = async (empId, duration) => {
  try {
    const employee = await Employee.findOne({ empId });
    if (!employee) return;

    const subject = `🚨 Break Overdue Alert - ${employee.employeeName}`;
    const html = `
      <div>
        <h2>Break Overdue Alert</h2>
        <p><strong>${employee.employeeName}</strong> exceeded their 60-minute break limit.</p>
        <p><strong>Duration:</strong> ${duration} minutes</p>
        <p><strong>Overdue By:</strong> ${duration - MAX_BREAK_MINUTES} minutes</p>
      </div>
    `;

    if (employee.email) {
      await sendEmail({ to: employee.email, subject, html });
    }

    const admin = await Employee.findOne({
      department: employee.department,
      role: { $in: ['admin', 'superadmin'] },
      email: { $ne: employee.email }
    });

    if (admin?.email) {
      await sendEmail({ to: admin.email, subject, html });
    }
  } catch (err) {
    console.error('❌ Failed to send overdue email:', err);
  }
};
