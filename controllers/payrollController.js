import { Payroll } from '../models/payrollModel.js';
import { Employee } from '../models/inhouseUserModel.js';

// 📌 Generate Payroll
export const generatePayroll = async (req, res) => {
  try {
    const { empId, month, basicSalary, bonus, deductions } = req.body;
    
    // Map the incoming data to the model structure
    const baseSalary = basicSalary || 0;
    const allowances = bonus || 0;
    const deductionsAmount = deductions || 0;
    
    const netSalary = baseSalary + allowances - deductionsAmount;
    const generatedBy = req.user.empId;

    // Validate required fields
    if (!empId || !month || !basicSalary) {
      return res.status(400).json({ 
        success: false, 
        message: 'empId, month, and basicSalary are required' 
      });
    }

    // Check if employee exists
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    const existing = await Payroll.findOne({ empId, month });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payroll already exists for this month' 
      });
    }

    const record = await Payroll.create({
      empId,
      month,
      baseSalary,
      allowances,
      deductions: deductionsAmount,
      netSalary,
      generatedBy
    });

    res.status(201).json({ 
      success: true, 
      message: 'Payroll generated successfully',
      payroll: record 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📌 Get Payrolls by HR/Admin
export const getAllPayrolls = async (req, res) => {
  try {
    const { month } = req.query;
    
    // ✅ Build filter based on query parameters
    const filter = {};
    
    // ✅ If month is provided, filter by that specific month
    if (month) {
      filter.month = month;
    }
    
    const records = await Payroll.find(filter).sort({ month: -1, createdAt: -1 });
    
    res.status(200).json({ 
      success: true, 
      records,
      filter: month ? `Filtered by month: ${month}` : 'All months',
      totalRecords: records.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📌 Get Own Payroll (Employee)
export const getOwnPayroll = async (req, res) => {
  try {
    const empId = req.user.empId;
    const records = await Payroll.find({ empId }).sort({ month: -1 });
    res.status(200).json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📌 Mark payroll as paid
export const markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Payroll.findByIdAndUpdate(id, { status: 'paid' }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Payroll not found' });

    res.status(200).json({ success: true, payroll: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📌 Get Payrolls by specific month
export const getPayrollsByMonth = async (req, res) => {
  try {
    const { month } = req.params;
    
    if (!month) {
      return res.status(400).json({ 
        success: false, 
        message: 'Month parameter is required (format: YYYY-MM)' 
      });
    }
    
    // ✅ Validate month format (YYYY-MM)
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid month format. Use YYYY-MM (e.g., 2025-08)' 
      });
    }
    
    const records = await Payroll.find({ month }).sort({ createdAt: -1 });
    
    res.status(200).json({ 
      success: true, 
      records,
      month,
      totalRecords: records.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
