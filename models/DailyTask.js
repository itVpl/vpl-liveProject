import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['calls', 'emails', 'rateRequest', 'talktime', 'deliveryOrder', 'truckCompany']
  },
  target: { type: Number, required: true },
  completed: { type: Number, default: 0 },
  mandatory: { type: Boolean, default: false }
});

const dailyTaskSchema = new mongoose.Schema({
  empId: { type: String, required: true },
  employeeName: { type: String },
  department: { type: String },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  tasks: [taskSchema],
  completed: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('DailyTask', dailyTaskSchema);
