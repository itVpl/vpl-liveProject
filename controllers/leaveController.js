import { LeaveRequest } from '../models/leaveModel.js';
import { Employee } from '../models/inhouseUserModel.js';
import { startOfMonth, endOfMonth, differenceInDays, addDays } from 'date-fns';
import moment from 'moment-timezone';

// 🔹 Apply for Leave
export const applyLeave = async (req, res) => {
  try {
    const { 
      empId, 
      leaveType, 
      fromDate, 
      toDate, 
      reason, 
      timezone,
      isHalfDay = false,
      halfDayType = null,
      halfDayStartTime = null,
      halfDayEndTime = null
    } = req.body;

    // Default timezone for US shift
    const userTimezone = timezone || 'America/New_York';

    // 🔹 Auto-detect half-day if leaveType is 'half-day'
    let finalIsHalfDay = isHalfDay;
    if (leaveType === 'half-day') {
      finalIsHalfDay = true;
    }

    // 🔹 Fix date range issues - ensure proper date handling
    const fromMoment = moment.tz(fromDate, userTimezone);
    const toMoment = moment.tz(toDate, userTimezone);
    
    // Always use startOf('day') for both dates to avoid timezone issues
    const fromDateTz = fromMoment.startOf('day').toDate();
    const toDateTz = toMoment.startOf('day').toDate();

    // ✅ 1. Validate Dates
    if (fromDateTz > toDateTz) {
      return res.status(400).json({
        success: false,
        message: "From Date must be before To Date"
      });
    }

    if (fromDateTz < moment.tz(userTimezone).startOf('day').toDate()) {
      return res.status(400).json({
        success: false,
        message: "Cannot apply leave for past dates"
      });
    }

    // ✅ 2. Validate Half-day parameters
    if (finalIsHalfDay) {
      if (!halfDayType || !['first_half', 'second_half'].includes(halfDayType)) {
        return res.status(400).json({
          success: false,
          message: "Half-day type must be 'first_half' or 'second_half'"
        });
      }

      // Half-day can only be applied for single day leaves
      if (!fromMoment.isSame(toMoment, 'day')) {
        return res.status(400).json({
          success: false,
          message: "Half-day leave can only be applied for single day"
        });
      }
    }

    // ✅ 3. Check overlapping leaves (including half-day overlaps)
    const overlapping = await LeaveRequest.findOne({
      empId,
      status: { $ne: 'rejected' },
      $or: [
        {
          fromDate: { $lte: toDateTz },
          toDate: { $gte: fromDateTz }
        }
      ]
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: "You already have a leave overlapping this date range"
      });
    }

    // ✅ 4. Calculate totalDays (considering half-day)
    let totalDays;
    if (finalIsHalfDay) {
      totalDays = 0.5; // Half day counts as 0.5 days
    } else {
      totalDays = differenceInDays(toDateTz, fromDateTz) + 1;
    }

    // ✅ 5. Restrict casual/sick to only 1 leave per month
    if (leaveType === "casual" || leaveType === "sick") {
      const start = moment.tz(userTimezone).startOf('month').toDate();
      const end = moment.tz(userTimezone).endOf('month').toDate();

      const existingLeave = await LeaveRequest.findOne({
        empId,
        leaveType,
        fromDate: { $gte: start, $lte: end },
        status: { $ne: 'rejected' }
      });

      if (existingLeave) {
        return res.status(400).json({
          success: false,
          message: `You have already applied for 1 ${leaveType} leave this month`
        });
      }
    }

    // ✅ 6. Create leave request with half-day support
    const leaveData = {
      empId,
      leaveType,
      fromDate: fromDateTz,
      toDate: toDateTz,
      reason,
      totalDays,
      isHalfDay: finalIsHalfDay,
      halfDayType: finalIsHalfDay ? halfDayType : null,
      halfDayStartTime: finalIsHalfDay ? halfDayStartTime : null,
      halfDayEndTime: finalIsHalfDay ? halfDayEndTime : null
    };

    const leave = await LeaveRequest.create(leaveData);

    res.status(201).json({ 
      success: true, 
      leave,
      message: finalIsHalfDay ? `Half-day ${leaveType} leave applied successfully` : `${leaveType} leave applied successfully`
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Approve/Reject Leave (HR - Only for manager_approved leaves)
export const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewedBy, remarks } = req.body;

    // Validate that user is HR department
    if (req.user.department !== 'HR') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only HR department can approve/reject leaves' 
      });
    }

    const leave = await LeaveRequest.findById(id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    // 🔹 IMPORTANT: HR can only approve/reject leaves that are manager_approved
    if (leave.status !== 'manager_approved') {
      return res.status(400).json({ 
        success: false, 
        message: `Leave status is ${leave.status}. HR can only approve/reject leaves that have been approved by manager first.` 
      });
    }

    const updatedLeave = await LeaveRequest.findByIdAndUpdate(id, {
      status,
      reviewedBy,
      reviewedAt: new Date(),
      remarks
    }, { new: true });

    res.status(200).json({ 
      success: true, 
      leave: updatedLeave,
      message: status === 'approved' 
        ? 'Leave finally approved by HR'
        : 'Leave rejected by HR'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Manager Approval for Leave
export const managerApproveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, managerRemarks } = req.body;
    const managerEmpId = req.user.empId;
    const managerName = req.user.employeeName;

    // Validate that user is an employee (manager)
    if (req.user.role !== 'employee') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only employees can approve leaves as managers' 
      });
    }

    const leave = await LeaveRequest.findById(id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    // Check if leave is in pending status
    if (leave.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: `Leave is already ${leave.status}. Cannot approve.` 
      });
    }

    // Update leave with manager approval
    const updatedLeave = await LeaveRequest.findByIdAndUpdate(id, {
      status: status === 'approved' ? 'manager_approved' : 'rejected',
      managerApprovedBy: managerEmpId,
      managerApprovedAt: new Date(),
      managerRemarks,
      // If manager rejects, also set HR fields
      ...(status === 'rejected' && {
        reviewedBy: managerEmpId,
        reviewedAt: new Date(),
        remarks: managerRemarks
      })
    }, { new: true });

    res.status(200).json({ 
      success: true, 
      leave: updatedLeave,
      message: status === 'approved' 
        ? 'Leave approved by manager and sent to HR for final approval'
        : 'Leave rejected by manager'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 HR Final Approval (only for manager_approved leaves)
export const hrFinalApproveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const hrEmpId = req.user.empId;

    // Validate that user is HR department
    if (req.user.department !== 'HR') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only HR department can give final approval' 
      });
    }

    const leave = await LeaveRequest.findById(id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    // Check if leave is in manager_approved status
    if (leave.status !== 'manager_approved') {
      return res.status(400).json({ 
        success: false, 
        message: `Leave status is ${leave.status}. Only manager approved leaves can be finalized by HR.` 
      });
    }

    // Update leave with HR final approval
    const updatedLeave = await LeaveRequest.findByIdAndUpdate(id, {
      status: status === 'approved' ? 'approved' : 'rejected',
      reviewedBy: hrEmpId,
      reviewedAt: new Date(),
      remarks
    }, { new: true });

    res.status(200).json({ 
      success: true, 
      leave: updatedLeave,
      message: status === 'approved' 
        ? 'Leave finally approved by HR'
        : 'Leave rejected by HR'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get leaves pending manager approval
export const getLeavesPendingManagerApproval = async (req, res) => {
  try {
    const leaves = await LeaveRequest.aggregate([
      {
        $match: {
          status: 'pending'
        }
      },
      {
        $lookup: {
          from: 'employees',
          localField: 'empId',
          foreignField: 'empId',
          as: 'employee'
        }
      },
      {
        $unwind: {
          path: '$employee',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          empName: '$employee.employeeName',
          department: '$employee.department',
          designation: '$employee.designation'
        }
      },
      {
        $project: {
          employee: 0
        }
      },
      {
        $sort: { appliedAt: -1 }
      }
    ]);
    
    res.status(200).json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get leaves pending HR approval (manager approved)
export const getLeavesPendingHRApproval = async (req, res) => {
  try {
    const leaves = await LeaveRequest.aggregate([
      {
        $match: {
          status: 'manager_approved'
        }
      },
      {
        $lookup: {
          from: 'employees',
          localField: 'empId',
          foreignField: 'empId',
          as: 'employee'
        }
      },
      {
        $unwind: {
          path: '$employee',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          empName: '$employee.employeeName',
          department: '$employee.department',
          designation: '$employee.designation'
        }
      },
      {
        $project: {
          employee: 0
        }
      },
      {
        $sort: { managerApprovedAt: -1 }
      }
    ]);
    
    res.status(200).json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get all leaves (HR)
export const getAllLeaves = async (req, res) => {
  try {
    const leaves = await LeaveRequest.aggregate([
      {
        $lookup: {
          from: 'employees', // Employee collection name
          localField: 'empId',
          foreignField: 'empId',
          as: 'employee'
        }
      },
      {
        $unwind: {
          path: '$employee',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          empName: '$employee.employeeName',
          department: '$employee.department',
          role: '$employee.role'
        }
      },
      {
        $project: {
          employee: 0 // Remove the employee object, keep only the fields we need
        }
      },
      {
        $sort: { appliedAt: -1 }
      }
    ]);
    
    res.status(200).json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get employee's leave (for HR)
export const getLeavesByEmployee = async (req, res) => {
  const { empId } = req.params;

  try {
    const leaves = await LeaveRequest.find({ empId }).sort({ appliedAt: -1 });
    res.status(200).json({ success: true, empId, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get my own leaves (Employee)
export const getMyLeaves = async (req, res) => {
  const empId = req.user.empId;

  try {
    const leaves = await LeaveRequest.find({ empId }).sort({ appliedAt: -1 });
    res.status(200).json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Monthly summary (for HR dashboard)
export const getMonthlyLeaveSummary = async (req, res) => {
  try {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());

    const data = await LeaveRequest.aggregate([
      {
        $match: {
          fromDate: { $gte: start, $lte: end },
          status: { $ne: 'rejected' }
        }
      },
      {
        $group: {
          _id: { empId: "$empId", leaveType: "$leaveType" },
          total: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Cancel Leave (only if pending)
export const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const empId = req.user.empId; // logged-in user

    const leave = await LeaveRequest.findOne({ _id: id, empId });

    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave not found" });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Only pending leave can be cancelled"
      });
    }

    await leave.deleteOne();

    res.status(200).json({ success: true, message: "Leave cancelled successfully" });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get Employee Leave Balance
export const getLeaveBalance = async (req, res) => {
  try {
    const { empId } = req.params;
    
    // Get employee details
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Get approved leaves for current year
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    const approvedLeaves = await LeaveRequest.aggregate([
      {
        $match: {
          empId,
          status: 'approved',
          fromDate: { $gte: startOfYear, $lte: endOfYear }
        }
      },
      {
        $group: {
          _id: '$leaveType',
          usedDays: { $sum: '$totalDays' }
        }
      }
    ]);

    // Calculate remaining balance
    const leaveUsage = {};
    approvedLeaves.forEach(leave => {
      leaveUsage[leave._id] = leave.usedDays;
    });

    const balance = {
      casual: {
        total: employee.leaveBalance.casual,
        used: leaveUsage.casual || 0,
        remaining: employee.leaveBalance.casual - (leaveUsage.casual || 0)
      },
      sick: {
        total: employee.leaveBalance.sick,
        used: leaveUsage.sick || 0,
        remaining: employee.leaveBalance.sick - (leaveUsage.sick || 0)
      },
      earned: {
        total: employee.leaveBalance.earned,
        used: leaveUsage.earned || 0,
        remaining: employee.leaveBalance.earned - (leaveUsage.earned || 0)
      },
      total: {
        total: employee.leaveBalance.total,
        used: (leaveUsage.casual || 0) + (leaveUsage.sick || 0) + (leaveUsage.earned || 0),
        remaining: employee.leaveBalance.total - ((leaveUsage.casual || 0) + (leaveUsage.sick || 0) + (leaveUsage.earned || 0))
      }
    };

    res.status(200).json({
      success: true,
      empId,
      employeeName: employee.employeeName,
      balance
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Smart Leave Application (with balance check)
export const applyLeaveWithBalance = async (req, res) => {
  try {
    const { 
      empId, 
      leaveType, 
      fromDate, 
      toDate, 
      reason,
      isHalfDay = false,
      halfDayType = null,
      halfDayStartTime = null,
      halfDayEndTime = null,
      timezone
    } = req.body;

    // Default timezone for US shift
    const userTimezone = timezone || 'America/New_York';

    // 🔹 Auto-detect half-day if leaveType is 'half-day'
    let finalIsHalfDay = isHalfDay;
    if (leaveType === 'half-day') {
      finalIsHalfDay = true;
    }

    // 🔹 Fix date range issues - ensure proper date handling
    const fromMoment = moment.tz(fromDate, userTimezone);
    const toMoment = moment.tz(toDate, userTimezone);
    
    // Always use startOf('day') for both dates to avoid timezone issues
    const fromDateTz = fromMoment.startOf('day').toDate();
    const toDateTz = toMoment.startOf('day').toDate();

    // ✅ 1. Validate Dates
    if (fromDateTz > toDateTz) {
      return res.status(400).json({
        success: false,
        message: "From Date must be before To Date"
      });
    }

    if (fromDateTz < moment.tz(userTimezone).startOf('day').toDate()) {
      return res.status(400).json({
        success: false,
        message: "Cannot apply leave for past dates"
      });
    }

    // ✅ 2. Validate Half-day parameters
    if (finalIsHalfDay) {
      if (!halfDayType || !['first_half', 'second_half'].includes(halfDayType)) {
        return res.status(400).json({
          success: false,
          message: "Half-day type must be 'first_half' or 'second_half'"
        });
      }

      // Half-day can only be applied for single day leaves
      if (!fromMoment.isSame(toMoment, 'day')) {
        return res.status(400).json({
          success: false,
          message: "Half-day leave can only be applied for single day"
        });
      }
    }

    // ✅ 3. Get Employee and Check Balance
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Calculate required days (considering half-day)
    let requiredDays;
    if (finalIsHalfDay) {
      requiredDays = 0.5; // Half day counts as 0.5 days
    } else {
      requiredDays = differenceInDays(toDateTz, fromDateTz) + 1;
    }

    // Get current balance
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    const approvedLeaves = await LeaveRequest.aggregate([
      {
        $match: {
          empId,
          status: 'approved',
          fromDate: { $gte: startOfYear, $lte: endOfYear }
        }
      },
      {
        $group: {
          _id: '$leaveType',
          usedDays: { $sum: '$totalDays' }
        }
      }
    ]);

    const leaveUsage = {};
    approvedLeaves.forEach(leave => {
      leaveUsage[leave._id] = leave.usedDays;
    });

    const remainingBalance = {
      casual: employee.leaveBalance.casual - (leaveUsage.casual || 0),
      sick: employee.leaveBalance.sick - (leaveUsage.sick || 0),
      earned: employee.leaveBalance.earned - (leaveUsage.earned || 0)
    };

    // ✅ 4. Check if enough balance available
    if (leaveType !== 'custom' && remainingBalance[leaveType] < requiredDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${leaveType} leave balance. Available: ${remainingBalance[leaveType]} days, Required: ${requiredDays} days`,
        balance: remainingBalance,
        required: requiredDays
      });
    }

    // ✅ 5. Check overlapping leaves (including half-day overlaps)
    const overlapping = await LeaveRequest.findOne({
      empId,
      status: { $ne: 'rejected' },
      $or: [
        {
          fromDate: { $lte: toDateTz },
          toDate: { $gte: fromDateTz }
        }
      ]
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: "You already have a leave overlapping this date range"
      });
    }

    // ✅ 6. Create leave request with half-day support
    const leaveData = {
      empId,
      leaveType,
      fromDate: fromDateTz,
      toDate: toDateTz,
      reason,
      totalDays: requiredDays,
      isHalfDay,
      halfDayType: isHalfDay ? halfDayType : null,
      halfDayStartTime: isHalfDay ? halfDayStartTime : null,
      halfDayEndTime: isHalfDay ? halfDayEndTime : null
    };

    const leave = await LeaveRequest.create(leaveData);

    res.status(201).json({ 
      success: true, 
      leave,
      balance: remainingBalance,
      message: isHalfDay 
        ? `Half-day ${leaveType} leave applied successfully. ${leaveType} leave balance remaining: ${remainingBalance[leaveType]} days`
        : `Leave applied successfully. ${leaveType} leave balance remaining: ${remainingBalance[leaveType]} days`
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Apply Half-Day Leave (dedicated function)
export const applyHalfDayLeave = async (req, res) => {
  try {
    const { 
      empId, 
      leaveType, 
      fromDate, 
      toDate, 
      reason, 
      timezone,
      halfDayType,
      halfDayStartTime = null,
      halfDayEndTime = null
    } = req.body;

    // Set isHalfDay to true for this function
    req.body.isHalfDay = true;
    
    // Validate half-day type
    if (!halfDayType || !['first_half', 'second_half'].includes(halfDayType)) {
      return res.status(400).json({
        success: false,
        message: "Half-day type must be 'first_half' or 'second_half'"
      });
    }

    // Call the main applyLeave function with half-day parameters
    return await applyLeave(req, res);

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Apply Half-Day Leave with Balance Check (dedicated function)
export const applyHalfDayLeaveWithBalance = async (req, res) => {
  try {
    const { 
      empId, 
      leaveType, 
      fromDate, 
      toDate, 
      reason, 
      timezone,
      halfDayType,
      halfDayStartTime = null,
      halfDayEndTime = null
    } = req.body;

    // Set isHalfDay to true for this function
    req.body.isHalfDay = true;
    
    // Validate half-day type
    if (!halfDayType || !['first_half', 'second_half'].includes(halfDayType)) {
      return res.status(400).json({
        success: false,
        message: "Half-day type must be 'first_half' or 'second_half'"
      });
    }

    // Call the main applyLeaveWithBalance function with half-day parameters
    return await applyLeaveWithBalance(req, res);

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get My Leave Balance (for logged-in employee)
export const getMyLeaveBalance = async (req, res) => {
  try {
    const empId = req.user.empId;
    
    // Get employee details
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Get approved leaves for current year
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    const approvedLeaves = await LeaveRequest.aggregate([
      {
        $match: {
          empId,
          status: 'approved',
          fromDate: { $gte: startOfYear, $lte: endOfYear }
        }
      },
      {
        $group: {
          _id: '$leaveType',
          usedDays: { $sum: '$totalDays' }
        }
      }
    ]);

    // Calculate remaining balance
    const leaveUsage = {};
    approvedLeaves.forEach(leave => {
      leaveUsage[leave._id] = leave.usedDays;
    });

    const balance = {
      casual: {
        total: employee.leaveBalance.casual,
        used: leaveUsage.casual || 0,
        remaining: employee.leaveBalance.casual - (leaveUsage.casual || 0)
      },
      sick: {
        total: employee.leaveBalance.sick,
        used: leaveUsage.sick || 0,
        remaining: employee.leaveBalance.sick - (leaveUsage.sick || 0)
      },
      earned: {
        total: employee.leaveBalance.earned,
        used: leaveUsage.earned || 0,
        remaining: employee.leaveBalance.earned - (leaveUsage.earned || 0)
      },
      total: {
        total: employee.leaveBalance.total,
        used: (leaveUsage.casual || 0) + (leaveUsage.sick || 0) + (leaveUsage.earned || 0),
        remaining: employee.leaveBalance.total - ((leaveUsage.casual || 0) + (leaveUsage.sick || 0) + (leaveUsage.earned || 0))
      }
    };

    res.status(200).json({
      success: true,
      empId,
      employeeName: employee.employeeName,
      balance
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Update Leave Balance (HR/Admin function)
export const updateLeaveBalance = async (req, res) => {
  try {
    const { empId } = req.params;
    const { casual, sick, earned, total } = req.body;

    const employee = await Employee.findOneAndUpdate(
      { empId },
      {
        'leaveBalance.casual': casual,
        'leaveBalance.sick': sick,
        'leaveBalance.earned': earned,
        'leaveBalance.total': total
      },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Leave balance updated successfully",
      employee
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get current month leaves (HR)
export const getCurrentMonthLeaves = async (req, res) => {
  try {
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log('🔍 Debug - Current month filter:', {
      startOfMonth,
      endOfMonth,
      currentMonth: currentDate.getMonth() + 1,
      currentYear: currentDate.getFullYear()
    });

    const leaves = await LeaveRequest.aggregate([
      {
        $match: {
          appliedAt: {
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        }
      },
      {
        $lookup: {
          from: 'employees',
          localField: 'empId',
          foreignField: 'empId',
          as: 'employee'
        }
      },
      {
        $unwind: {
          path: '$employee',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          empName: '$employee.employeeName',
          department: '$employee.department',
          role: '$employee.role'
        }
      },
      {
        $project: {
          employee: 0
        }
      },
      {
        $sort: { appliedAt: -1 }
      }
    ]);

    console.log('🔍 Debug - Current month leaves found:', leaves.length);

    res.status(200).json({
      success: true,
      message: 'Current month leaves retrieved successfully',
      currentMonth: currentDate.getMonth() + 1,
      currentYear: currentDate.getFullYear(),
      total: leaves.length,
      leaves
    });

  } catch (error) {
    console.error('❌ Error in getCurrentMonthLeaves:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving current month leaves',
      error: error.message
    });
  }
};
