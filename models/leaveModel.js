import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
  empId: { type: String, required: true },
  leaveType: { type: String, enum: ['casual', 'sick', 'custom'], required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  reason: { type: String },
  totalDays: { type: Number },

  // 🔹 Half-day functionality
  isHalfDay: { type: Boolean, default: false },
  halfDayType: { 
    type: String, 
    enum: ['first_half', 'second_half', null], 
    default: null 
  },
  // 🔹 Time slots for half-day (optional)
  halfDayStartTime: { type: String }, // Format: "09:00"
  halfDayEndTime: { type: String },   // Format: "13:00"
  // 🔹 Updated status to include manager approval
 
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },

  appliedAt: { type: Date, default: Date.now },
  // 🔹 Manager approval fields
  managerApprovedBy: { type: String }, // Manager empId
  managerApprovedAt: { type: Date },
  managerRemarks: { type: String },
  // 🔹 HR approval fields
  reviewedBy: { type: String }, // HR empId
  reviewedAt: { type: Date },
  remarks: { type: String }
});

const LeaveRequest = mongoose.model('LeaveRequest', leaveSchema);
export { LeaveRequest };