import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema({
  empId: { type: String, required: true },
  month: { type: String, required: true }, // Format: "YYYY-MM"
  baseSalary: { type: Number, required: true },
  allowances: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  netSalary: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  generatedBy: { type: String }, // HR or Admin empId
}, { timestamps: true });

export const Payroll = mongoose.model('Payroll', payrollSchema);
