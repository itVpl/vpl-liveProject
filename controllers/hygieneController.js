// controllers/hygieneController.js
import { UserActivity } from "../models/userActivityModel.js";
import { Target } from "../models/targetModel.js";
import BreakLog from "../models/BreakLog.js";
import { Employee } from "../models/inhouseUserModel.js";

// Utility to check overdue break
const hasOverdueBreaks = async (empId, startDate, endDate) => {
  const logs = await BreakLog.find({
    empId,
    startTime: { $gte: new Date(startDate) },
    endTime: { $lte: new Date(endDate) },
    isOverdue: true,
  });
  return logs.length > 0;
};

const hasIncompleteTargets = async (empId, startDate, endDate) => {
  const pending = await Target.find({
    empId,
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    status: { $ne: "completed" },
  });
  return pending.length > 0;
};

const getAttendanceStats = async (empId, startDate, endDate) => {
  const attended = await UserActivity.find({
    empId,
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    status: "completed",
  });

  const totalDays = Math.ceil(
    (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
  ) + 1;

  const daysPresent = attended.length;
  const attendancePercent = ((daysPresent / totalDays) * 100).toFixed(2);
  return { attendancePercent, totalDays, daysPresent };
};

export const getHygieneReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const requester = req.user;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ success: false, message: "Date range required" });
    }

    let employees = [];
    if (requester.role === "employee") {
      const emp = await Employee.findOne({ empId: requester.empId });
      if (!emp) return res.status(404).json({ success: false, message: "User not found" });
      employees.push(emp);
    } else {
      // HR or Superadmin
      employees = await Employee.find({});
    }

    const report = [];

    for (const emp of employees) {
      const { empId, employeeName, department } = emp;

      const attendance = await getAttendanceStats(empId, startDate, endDate);
      const hasOverdue = await hasOverdueBreaks(empId, startDate, endDate);
      const hasPendingTarget = await hasIncompleteTargets(empId, startDate, endDate);

      let failed = 0;
      if (attendance.attendancePercent < 100) failed++;
      if (hasOverdue) failed++;
      if (hasPendingTarget) failed++;

      let performance = "Good";
      if (failed === 1) performance = "Average";
      if (failed >= 2) performance = "Poor";

      report.push({
        empId,
        employeeName,
        department,
        performance,
        attendancePercent: attendance.attendancePercent,
        overdueBreaks: hasOverdue,
        pendingTargets: hasPendingTarget,
      });
    }

    res.status(200).json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Self Hygiene Report
export const getSelfHygieneReport = async (req, res) => {
    try {
      const empId = req.user.empId;
  
      // Attendance check
      const attendanceRecords = await UserActivity.find({ empId });
      const totalDays = attendanceRecords.length;
      const presentDays = attendanceRecords.filter(r => r.totalHours >= 8).length;
      const fullAttendance = totalDays > 0 && totalDays === presentDays;
  
      // Breaks check
      const overdueBreaks = await BreakLog.find({ empId, overdue: true });
      const hasOverdue = overdueBreaks.length > 0;
  
      // Target check
      const targetRecords = await DailyTarget.find({ empId });
      const completedTargets = targetRecords.filter(t => t.completed === true).length;
      const allTargetCompleted = targetRecords.length > 0 && completedTargets === targetRecords.length;
  
      // Hygiene evaluation
      let performance = "Poor";
      if (fullAttendance && !hasOverdue && allTargetCompleted) {
        performance = "Good";
      } else if (presentDays >= totalDays * 0.75) {
        performance = "Average";
      }
  
      res.status(200).json({
        success: true,
        empId,
        totalAttendanceDays: totalDays,
        presentDays,
        overdueBreaks: overdueBreaks.length,
        completedTargets,
        performance
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
