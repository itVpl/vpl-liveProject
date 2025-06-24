import mongoose from 'mongoose';

const breakLogSchema = new mongoose.Schema({
  empId: { type: String, required: true },
  breakType: {
    type: String,
    default: 'Break' // Fixed label
  },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  durationMinutes: { type: Number },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  overdue: { type: Boolean, default: false }
}, { timestamps: true });

const BreakLog = mongoose.model('BreakLog', breakLogSchema);
export default BreakLog;
