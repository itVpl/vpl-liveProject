import BreakLog from '../models/BreakLog.js';
import { Employee } from '../models/inhouseUserModel.js';
import moment from 'moment';
import { sendEmail } from '../utils/sendEmail.js';

const breakDurations = { Dinner: 30, Bio: 5, Smoking: 5 };
const dailyBreakLimit = 60; // Total 60 minutes per day

export const startBreak = async (req, res) => {
  try {
    const authenticatedUser = req.user;
    const { breakType, empId: requestedEmpId } = req.body;
    const today = moment().format('YYYY-MM-DD');

    // Determine which empId to use
    let targetEmpId;
    
    // If empId is provided in request and user is admin/HR, use that empId
    if (requestedEmpId && (authenticatedUser.role === 'admin' || authenticatedUser.role === 'superadmin')) {
      targetEmpId = requestedEmpId;
      console.log(`🔧 Admin ${authenticatedUser.empId} starting break for employee ${targetEmpId}`);
    } else {
      // Use authenticated user's empId
      targetEmpId = authenticatedUser.empId;
    }

    // Validate break type
    if (!breakType || !breakDurations[breakType]) {
      return res.status(400).json({
        success: false,
        message: `Invalid break type. Allowed types: ${Object.keys(breakDurations).join(', ')}`
      });
    }

    // Check if user already has an ongoing break
    const ongoingBreak = await BreakLog.findOne({ empId: targetEmpId, endTime: null });
    if (ongoingBreak) {
      return res.status(400).json({ 
        success: false, 
        message: `Employee ${targetEmpId} already has an ongoing ${ongoingBreak.breakType} break. Please end it first.` 
      });
    }

    // Check daily break limit
    const todayBreaks = await BreakLog.find({ 
      empId: targetEmpId, 
      date: today,
      endTime: { $exists: true }
    });
    
    const totalMinutesUsed = todayBreaks.reduce((sum, br) => sum + (br.durationMinutes || 0), 0);
    const remainingMinutes = dailyBreakLimit - totalMinutesUsed;
    
    if (remainingMinutes <= 0) {
      return res.status(400).json({
        success: false,
        message: `Employee ${targetEmpId} has reached daily break limit. Cannot take more breaks today.`
      });
    }

    const startTime = new Date();
    const newBreak = await BreakLog.create({ empId: targetEmpId, breakType, startTime, date: today });
    
    console.log(`✅ Break started: ${targetEmpId} - ${breakType} at ${formatDate(startTime)}`);
    
    res.status(200).json({ 
      success: true, 
      message: `${breakType} break started successfully for ${targetEmpId}.`,
      breakId: newBreak._id,
      empId: targetEmpId,
      startTime: formatDate(startTime),
      remainingMinutes: remainingMinutes - breakDurations[breakType],
      maxDuration: breakDurations[breakType]
    });
  } catch (err) {
    console.error('❌ Error starting break:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const endBreak = async (req, res) => {
  try {
    const authenticatedUser = req.user;
    const { empId: requestedEmpId } = req.body || {};

    // Determine which empId to use
    let targetEmpId;
    
    // If empId is provided in request and user is admin/HR, use that empId
    if (requestedEmpId && (authenticatedUser.role === 'admin' || authenticatedUser.role === 'superadmin')) {
      targetEmpId = requestedEmpId;
      console.log(`🔧 Admin ${authenticatedUser.empId} ending break for employee ${targetEmpId}`);
    } else {
      // Use authenticated user's empId
      targetEmpId = authenticatedUser.empId;
    }

    const ongoingBreak = await BreakLog.findOne({ empId: targetEmpId, endTime: null }).sort({ startTime: -1 });

    if (!ongoingBreak) {
      return res.status(404).json({ 
        success: false, 
        message: `No ongoing break found for ${targetEmpId}. Please start a break first.` 
      });
    }

    const endTime = new Date();
    const durationMinutes = Math.floor((endTime - ongoingBreak.startTime) / 60000);

    // Check if break duration exceeds limit
    const maxDuration = breakDurations[ongoingBreak.breakType];
    const isOverdue = durationMinutes > maxDuration;
    
    if (isOverdue) {
      ongoingBreak.overdue = true;
      console.log(`⚠️ Overdue break detected: ${targetEmpId} - ${ongoingBreak.breakType} (${durationMinutes}min > ${maxDuration}min)`);
      
      // Send notification to employee and admin
      await sendOverdueNotification(targetEmpId, ongoingBreak.breakType, durationMinutes, maxDuration);
    }

    ongoingBreak.endTime = endTime;
    ongoingBreak.durationMinutes = durationMinutes;
    await ongoingBreak.save();

    console.log(`✅ Break ended: ${targetEmpId} - ${ongoingBreak.breakType} (${durationMinutes}min)${isOverdue ? ' - OVERDUE' : ''}`);

    res.status(200).json({ 
      success: true, 
      message: `${ongoingBreak.breakType} break ended successfully for ${targetEmpId}.`,
      breakId: ongoingBreak._id,
      empId: targetEmpId,
      duration: `${durationMinutes} minutes`,
      maxAllowed: `${maxDuration} minutes`,
      endTime: formatDate(endTime),
      overdue: isOverdue,
      overdueBy: isOverdue ? `${durationMinutes - maxDuration} minutes` : null
    });
  } catch (err) {
    console.error('❌ Error ending break:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get employee's own break history
export const getMyBreakHistory = async (req, res) => {
  try {
    const empId = req.user.empId;
    const { date } = req.query;
    
    let filter = { empId };
    if (date) {
      filter.date = date;
    }

    const breaks = await BreakLog.find(filter)
      .sort({ startTime: -1 })
      .limit(50);

    const formattedBreaks = breaks.map(br => ({
      id: br._id,
      breakType: br.breakType,
      startTime: formatDate(br.startTime),
      endTime: br.endTime ? formatDate(br.endTime) : null,
      durationMinutes: br.durationMinutes || 0,
      overdue: br.overdue,
      date: br.date
    }));

    res.status(200).json({
      success: true,
      breaks: formattedBreaks
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all breaks for admin/HR
export const getAllBreaks = async (req, res) => {
  try {
    const { date, empId, overdue } = req.query;
    let filter = {};

    if (date) filter.date = date;
    if (empId) filter.empId = empId;
    if (overdue === 'true') filter.overdue = true;

    const breaks = await BreakLog.find(filter)
      .sort({ startTime: -1 })
      .populate('empId', 'employeeName department');

    const formattedBreaks = breaks.map(br => ({
      id: br._id,
      empId: br.empId,
      employeeName: br.empId?.employeeName || 'Unknown',
      department: br.empId?.department || 'Unknown',
      breakType: br.breakType,
      startTime: formatDate(br.startTime),
      endTime: br.endTime ? formatDate(br.endTime) : null,
      durationMinutes: br.durationMinutes || 0,
      overdue: br.overdue,
      date: br.date
    }));

    res.status(200).json({
      success: true,
      breaks: formattedBreaks
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get overdue breaks for admin/HR
export const getOverdueBreaks = async (req, res) => {
  try {
    const overdueBreaks = await BreakLog.find({ 
      overdue: true,
      endTime: { $exists: true }
    })
    .sort({ endTime: -1 })
    .populate('empId', 'employeeName department email');

    const formattedBreaks = overdueBreaks.map(br => ({
      id: br._id,
      empId: br.empId,
      employeeName: br.empId?.employeeName || 'Unknown',
      department: br.empId?.department || 'Unknown',
      email: br.empId?.email || '',
      breakType: br.breakType,
      startTime: formatDate(br.startTime),
      endTime: formatDate(br.endTime),
      durationMinutes: br.durationMinutes,
      date: br.date
    }));

    res.status(200).json({
      success: true,
      overdueBreaks: formattedBreaks
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Send notification for overdue breaks
const sendOverdueNotification = async (empId, breakType, actualDuration, maxDuration) => {
  try {
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      console.warn("❌ Employee not found for empId:", empId);
      return;
    }

    const subject = `Break Overdue Alert - ${employee.employeeName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Break Overdue Alert</h2>
        <p>Dear ${employee.employeeName},</p>
        
        <p>Your <strong>${breakType}</strong> break has exceeded the allowed duration.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Break Details:</h3>
          <ul>
            <li><strong>Break Type:</strong> ${breakType}</li>
            <li><strong>Allowed Duration:</strong> ${maxDuration} minutes</li>
            <li><strong>Actual Duration:</strong> ${actualDuration} minutes</li>
            <li><strong>Overdue by:</strong> ${actualDuration - maxDuration} minutes</li>
          </ul>
        </div>
        
        <p>Please be mindful of break timings in the future.</p>
        
        <p>Best regards,<br>VPL Team</p>
      </div>
    `;

    // ✅ Send email to employee (only if email exists)
    if (employee?.email) {
      console.log("📧 Sending email to employee:", employee.email);
      await sendEmail({ 
        to: employee.email, 
        subject: subject, 
        html: html 
      });
    } else {
      console.warn("❌ Employee email not found for empId:", empId);
    }

    // ✅ Send notification to department admin
    const admin = await Employee.findOne({ 
      department: employee.department,
      role: { $in: ['admin', 'superadmin'] }
    });

    if (admin && admin.email && admin.email !== employee.email) {
      const adminSubject = `Employee Break Overdue - ${employee.employeeName}`;
      const adminHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">Employee Break Overdue Alert</h2>
          <p>Dear ${admin.employeeName},</p>
          
          <p>Employee <strong>${employee.employeeName}</strong> (${empId}) has exceeded their ${breakType} break duration.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Employee Details:</h3>
            <ul>
              <li><strong>Employee:</strong> ${employee.employeeName} (${empId})</li>
              <li><strong>Department:</strong> ${employee.department}</li>
              <li><strong>Break Type:</strong> ${breakType}</li>
              <li><strong>Allowed Duration:</strong> ${maxDuration} minutes</li>
              <li><strong>Actual Duration:</strong> ${actualDuration} minutes</li>
              <li><strong>Overdue by:</strong> ${actualDuration - maxDuration} minutes</li>
            </ul>
          </div>
          
          <p>Please take appropriate action.</p>
          
          <p>Best regards,<br>VPL System</p>
        </div>
      `;

      console.log("📧 Sending email to admin:", admin.email);
      await sendEmail({ 
        to: admin.email, 
        subject: adminSubject, 
        html: adminHtml 
      });
    } else {
      console.warn("❌ Admin email not found or same as employee");
    }

  } catch (err) {
    console.error('❌ Error sending overdue notification:', err);
  }
};

// Helper function to format date
const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

export const checkOverdueBreaks = async () => {
  const now = new Date();
  const ongoingBreaks = await BreakLog.find({ endTime: null, overdue: false });

  for (const br of ongoingBreaks) {
    const maxDuration = breakDurations[br.breakType];
    const minutesPassed = Math.floor((now - br.startTime) / 60000);

    if (minutesPassed > maxDuration) {
      br.overdue = true;
      await br.save();

      // Send notification for ongoing overdue breaks
      await sendOverdueNotification(br.empId, br.breakType, minutesPassed, maxDuration);
    }
  }
};