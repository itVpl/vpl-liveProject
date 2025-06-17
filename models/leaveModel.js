import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
  empId: { type: String, required: true },
  leaveType: { type: String, enum: ['casual', 'sick'], required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  reason: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  appliedAt: { type: Date, default: Date.now },
  reviewedBy: { type: String }, // HR empId
  reviewedAt: { type: Date }
});

const LeaveRequest = mongoose.model('LeaveRequest', leaveSchema);
export { LeaveRequest };