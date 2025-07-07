import { LeaveRequest } from '../models/leaveModel.js';
import { Employee } from '../models/inhouseUserModel.js';
import { startOfMonth, endOfMonth, differenceInDays, addDays } from 'date-fns';

// 🔹 Apply for Leave
export const applyLeave = async (req, res) => {
  try {
    const { empId, leaveType, fromDate, toDate, reason } = req.body;

    // ✅ 1. Validate Dates
    if (new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({
        success: false,
        message: "From Date must be before To Date"
      });
    }

    if (new Date(fromDate) < new Date().setHours(0, 0, 0, 0)) {
      return res.status(400).json({
        success: false,
        message: "Cannot apply leave for past dates"
      });
    }

    // ✅ 2. Check overlapping leaves
    const overlapping = await LeaveRequest.findOne({
      empId,
      status: { $ne: 'rejected' },
      $or: [
        {
          fromDate: { $lte: new Date(toDate) },
          toDate: { $gte: new Date(fromDate) }
        }
      ]
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: "You already have a leave overlapping this date range"
      });
    }

    // ✅ 3. totalDays calculation
    const totalDays = (new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24) + 1;

    // ✅ 4. Restrict casual/sick to only 1 leave per month
    if (leaveType === "casual" || leaveType === "sick") {
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());

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

    // ✅ 5. Allow custom leave with no restriction
    const leave = await LeaveRequest.create({
      empId,
      leaveType,
      fromDate,
      toDate,
      reason,
      totalDays
    });

    res.status(201).json({ success: true, leave });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Approve/Reject Leave
export const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewedBy, remarks } = req.body;

    const leave = await LeaveRequest.findByIdAndUpdate(id, {
      status,
      reviewedBy,
      reviewedAt: new Date(),
      remarks
    }, { new: true });

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    res.status(200).json({ success: true, leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get all leaves (HR)
export const getAllLeaves = async (req, res) => {
  try {
    const leaves = await LeaveRequest.find().sort({ appliedAt: -1 });
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
    const { empId, leaveType, fromDate, toDate, reason } = req.body;

    // ✅ 1. Validate Dates
    if (new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({
        success: false,
        message: "From Date must be before To Date"
      });
    }

    if (new Date(fromDate) < new Date().setHours(0, 0, 0, 0)) {
      return res.status(400).json({
        success: false,
        message: "Cannot apply leave for past dates"
      });
    }

    // ✅ 2. Get Employee and Check Balance
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Calculate required days
    const requiredDays = differenceInDays(new Date(toDate), new Date(fromDate)) + 1;

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

    // ✅ 3. Check if enough balance available
    if (leaveType !== 'custom' && remainingBalance[leaveType] < requiredDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${leaveType} leave balance. Available: ${remainingBalance[leaveType]} days, Required: ${requiredDays} days`,
        balance: remainingBalance,
        required: requiredDays
      });
    }

    // ✅ 4. Check overlapping leaves
    const overlapping = await LeaveRequest.findOne({
      empId,
      status: { $ne: 'rejected' },
      $or: [
        {
          fromDate: { $lte: new Date(toDate) },
          toDate: { $gte: new Date(fromDate) }
        }
      ]
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: "You already have a leave overlapping this date range"
      });
    }

    // ✅ 5. Create leave request
    const leave = await LeaveRequest.create({
      empId,
      leaveType,
      fromDate,
      toDate,
      reason,
      totalDays: requiredDays
    });

    res.status(201).json({ 
      success: true, 
      leave,
      balance: remainingBalance,
      message: `Leave applied successfully. ${leaveType} leave balance remaining: ${remainingBalance[leaveType]} days`
    });

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
