import { LeaveRequest } from '../models/leaveModel.js';
import { startOfMonth, endOfMonth } from 'date-fns';

// 🔹 Apply for Leave
export const applyLeave = async (req, res) => {
  const { empId, leaveType, fromDate, toDate, reason } = req.body;

  // ✅ Check if user already took leave of same type this month
  const start = startOfMonth(new Date());
  const end = endOfMonth(new Date());

  const count = await LeaveRequest.countDocuments({
    empId,
    leaveType,
    fromDate: { $gte: start, $lte: end },
    status: { $ne: 'rejected' }
  });

  if (count >= 1) {
    return res.status(400).json({ success: false, message: `You already applied for 1 ${leaveType} leave this month` });
  }

  const leave = await LeaveRequest.create({ empId, leaveType, fromDate, toDate, reason });
  res.status(201).json({ success: true, leave });
};

// 🔹 Approve/Reject Leave
export const updateLeaveStatus = async (req, res) => {
  const { id } = req.params;
  const { status, reviewedBy } = req.body;

  const leave = await LeaveRequest.findByIdAndUpdate(id, {
    status,
    reviewedBy,
    reviewedAt: new Date()
  }, { new: true });

  if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });

  res.status(200).json({ success: true, leave });
};

// 🔹 Get all leaves (for HR)
export const getAllLeaves = async (req, res) => {
  const leaves = await LeaveRequest.find().sort({ appliedAt: -1 });
  res.status(200).json({ success: true, leaves });
};


// 🔹 Get leaves of a specific employee (for HR)
export const getLeavesByEmployee = async (req, res) => {
  const { empId } = req.params;

  try {
    const leaves = await LeaveRequest.find({ empId }).sort({ appliedAt: -1 });
    res.status(200).json({
      success: true,
      empId,
      leaves
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// 🔹 Get my leaves (for logged-in employee)
export const getMyLeaves = async (req, res) => {
  const empId = req.user.empId; // Assuming auth middleware attaches empId

  try {
    const leaves = await LeaveRequest.find({ empId }).sort({ appliedAt: -1 });
    res.status(200).json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};