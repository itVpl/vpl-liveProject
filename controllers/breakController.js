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

    // Send email to user and department admin
    try {
      const employee = await Employee.findOne({ empId });
      if (employee && employee.email) {
        const subject = `🟢 Break Started - ${employee.employeeName}`;
        const html = `
          <div style="font-family: Arial, sans-serif; background: #f4f8fb; padding: 32px; border-radius: 12px; max-width: 480px; margin: 24px auto; box-shadow: 0 2px 8px #e3eaf1;">
            <h2 style="color: #2a7ae2; text-align: center; margin-bottom: 16px;">🟢 Break Started</h2>
            <p style="font-size: 18px; color: #222; text-align: center;"><b>${employee.employeeName}</b> (${employee.empId})</p>
            <p style="font-size: 15px; color: #555; text-align: center; margin-bottom: 16px;">Department: <b>${employee.department || 'N/A'}</b></p>
            <div style="background: #fff; border-radius: 8px; padding: 18px 20px; margin-bottom: 12px; border: 1px solid #e3eaf1;">
              <p style="font-size: 16px; color: #333;"><b>Break Start Time:</b> <span style="color: #2a7ae2;">${startTime.toLocaleString()}</span></p>
            </div>
            <p style="font-size: 14px; color: #888; text-align: center; margin-top: 18px;">This is an automated notification from <b>V Power Logistics</b>.</p>
          </div>
        `;
        await sendEmail({ to: employee.email, subject, html });
      }
      // Send to department admin (not the user themself)
      if (employee && employee.department) {
        const admin = await Employee.findOne({
          department: employee.department,
          role: { $in: ['admin', 'superadmin'] },
          email: { $ne: employee.email }
        });
        if (admin && admin.email) {
          const subject = `🟢 Break Started - ${employee.employeeName}`;
          const html = `
            <div style="font-family: Arial, sans-serif; background: #f4f8fb; padding: 32px; border-radius: 12px; max-width: 480px; margin: 24px auto; box-shadow: 0 2px 8px #e3eaf1;">
              <h2 style="color: #2a7ae2; text-align: center; margin-bottom: 16px;">🟢 Break Started (Team Member)</h2>
              <p style="font-size: 18px; color: #222; text-align: center;"><b>${employee.employeeName}</b> (${employee.empId})</p>
              <p style="font-size: 15px; color: #555; text-align: center; margin-bottom: 16px;">Department: <b>${employee.department || 'N/A'}</b></p>
              <div style="background: #fff; border-radius: 8px; padding: 18px 20px; margin-bottom: 12px; border: 1px solid #e3eaf1;">
                <p style="font-size: 16px; color: #333;"><b>Break Start Time:</b> <span style="color: #2a7ae2;">${startTime.toLocaleString()}</span></p>
              </div>
              <p style="font-size: 14px; color: #888; text-align: center; margin-top: 18px;">This is an automated notification from <b>V Power Logistics</b>.</p>
            </div>
          `;
          await sendEmail({ to: admin.email, subject, html });
        }
      }
    } catch (emailErr) {
      console.error('❌ Failed to send break start email:', emailErr);
    }

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
    const durationMs = endTime - ongoing.startTime;
    const durationSeconds = Math.floor(durationMs / 1000);
    const durationMinutes = Math.floor(durationMs / 60000);
    const isOverdue = durationMinutes > MAX_BREAK_MINUTES;

    ongoing.endTime = endTime;
    ongoing.durationMinutes = durationMinutes;
    ongoing.durationSeconds = durationSeconds;
    ongoing.overdue = isOverdue;
    await ongoing.save();

    if (isOverdue) {
      await sendOverdueNotification(empId, durationMinutes);
    }

    // Send email to user and department admin on break end
    try {
      const employee = await Employee.findOne({ empId });
      if (employee && employee.email) {
        const subject = `🔴 Break Ended - ${employee.employeeName}`;
        const html = `
          <div style="font-family: Arial, sans-serif; background: #fff7f7; padding: 32px; border-radius: 12px; max-width: 480px; margin: 24px auto; box-shadow: 0 2px 8px #f3e3e3;">
            <h2 style="color: #e22a2a; text-align: center; margin-bottom: 16px;">🔴 Break Ended</h2>
            <p style="font-size: 18px; color: #222; text-align: center;"><b>${employee.employeeName}</b> (${employee.empId})</p>
            <p style="font-size: 15px; color: #555; text-align: center; margin-bottom: 16px;">Department: <b>${employee.department || 'N/A'}</b></p>
            <div style="background: #fff; border-radius: 8px; padding: 18px 20px; margin-bottom: 12px; border: 1px solid #f3e3e3;">
              <p style="font-size: 16px; color: #333;"><b>Break End Time:</b> <span style="color: #e22a2a;">${endTime.toLocaleString()}</span></p>
              <p style="font-size: 16px; color: #333;"><b>Duration:</b> <span style="color: #e22a2a;">${durationMinutes} min ${durationSeconds % 60} sec</span></p>
            </div>
            <p style="font-size: 14px; color: #888; text-align: center; margin-top: 18px;">This is an automated notification from <b>V Power Logistics</b>.</p>
          </div>
        `;
        await sendEmail({ to: employee.email, subject, html });
      }
      // Send to department admin (not the user themself)
      if (employee && employee.department) {
        const admin = await Employee.findOne({
          department: employee.department,
          role: { $in: ['admin', 'superadmin'] },
          email: { $ne: employee.email }
        });
        if (admin && admin.email) {
          const subject = `🔴 Break Ended - ${employee.employeeName}`;
          const html = `
            <div style="font-family: Arial, sans-serif; background: #fff7f7; padding: 32px; border-radius: 12px; max-width: 480px; margin: 24px auto; box-shadow: 0 2px 8px #f3e3e3;">
              <h2 style="color: #e22a2a; text-align: center; margin-bottom: 16px;">🔴 Break Ended (Team Member)</h2>
              <p style="font-size: 18px; color: #222; text-align: center;"><b>${employee.employeeName}</b> (${employee.empId})</p>
              <p style="font-size: 15px; color: #555; text-align: center; margin-bottom: 16px;">Department: <b>${employee.department || 'N/A'}</b></p>
              <div style="background: #fff; border-radius: 8px; padding: 18px 20px; margin-bottom: 12px; border: 1px solid #f3e3e3;">
                <p style="font-size: 16px; color: #333;"><b>Break End Time:</b> <span style="color: #e22a2a;">${endTime.toLocaleString()}</span></p>
                <p style="font-size: 16px; color: #333;"><b>Duration:</b> <span style="color: #e22a2a;">${durationMinutes} min ${durationSeconds % 60} sec</span></p>
              </div>
              <p style="font-size: 14px; color: #888; text-align: center; margin-top: 18px;">This is an automated notification from <b>V Power Logistics</b>.</p>
            </div>
          `;
          await sendEmail({ to: admin.email, subject, html });
        }
      }
    } catch (emailErr) {
      console.error('❌ Failed to send break end email:', emailErr);
    }

    // 🔄 Calculate new remaining time
    const today = moment().format('YYYY-MM-DD');
    const todayBreaks = await BreakLog.find({ empId, date: today, endTime: { $exists: true } });
    const totalUsed = todayBreaks.reduce((sum, b) => sum + (b.durationSeconds || 0), 0);
    const remaining = Math.max((MAX_BREAK_MINUTES * 60) - totalUsed, 0);

    res.status(200).json({
      success: true,
      message: `Break ended successfully. ${isOverdue ? 'Break exceeded 60 minutes!' : ''}`,
      empId,
      breakId: ongoing._id,
      durationSeconds,
      durationMinutes,
      overdue: isOverdue,
      endTime,
      remainingSeconds: remaining,
      maxLimitSeconds: MAX_BREAK_MINUTES * 60
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
