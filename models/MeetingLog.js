import mongoose from 'mongoose';

const meetingLogSchema = new mongoose.Schema({
  empId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  durationMinutes: { type: Number },
  durationSeconds: { type: Number },
  date: { type: String, required: true, default: () => new Date().toISOString().slice(0, 10) },
  status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const MeetingLog = mongoose.model('MeetingLog', meetingLogSchema);
export default MeetingLog; 