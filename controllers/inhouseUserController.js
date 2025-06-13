import Employee from '../models/inhouseUserModel.js';
import { normalizePath } from '../middlewares/upload.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// 🔹 Create new employee
export const createEmployee = async (req, res) => {
  try {
    const {
      empId,
      employeeName,
      sex,
      email,
      mobileNo,
      alternateNo,
      emergencyNo,
      department,
      designation,
      dateOfJoining,
      accountHolderName,
      accountNumber,
      ifscCode,
      password
    } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle file uploads for identityDocs
    const pancardPath = req.files && req.files.pancard ? normalizePath(req.files.pancard[0].path) : undefined;
    const aadharcardPath = req.files && req.files.aadharcard ? normalizePath(req.files.aadharcard[0].path) : undefined;
    const educationalDocsPaths = req.files && req.files.educationalDocs ? req.files.educationalDocs.map(f => normalizePath(f.path)) : [];

    // Handle file uploads for previousCompanyDocs
    const releaseLetterPath = req.files && req.files.releaseLetter ? normalizePath(req.files.releaseLetter[0].path) : undefined;
    const offerLetterPath = req.files && req.files.offerLetter ? normalizePath(req.files.offerLetter[0].path) : undefined;
    const experienceLetterPath = req.files && req.files.experienceLetter ? normalizePath(req.files.experienceLetter[0].path) : undefined;
    const bankStatementOrSalarySlipPaths = req.files && req.files.bankStatementOrSalarySlip ? req.files.bankStatementOrSalarySlip.map(f => normalizePath(f.path)) : [];

    const newEmployeeData = {
      empId,
      employeeName,
      sex,
      email,
      mobileNo,
      alternateNo,
      emergencyNo,
      department,
      designation,
      dateOfJoining,
      identityDocs: {
        panCard: pancardPath,
        aadharCard: aadharcardPath,
        educationalDocs: educationalDocsPaths
      },
      previousCompanyDocs: {
        releaseLetter: releaseLetterPath,
        offerLetter: offerLetterPath,
        experienceLetter: experienceLetterPath,
        bankStatementOrSalarySlip: bankStatementOrSalarySlipPaths
      },
      bankDetails: {
        accountHolderName,
        accountNumber,
        ifscCode
      },
      password: hashedPassword
    };

    let newEmployee;
    try {
      newEmployee = await Employee.create(newEmployeeData);
    } catch (err) {
      // Rollback: Delete uploaded files if DB insert fails
      const allFilePaths = [
        pancardPath,
        aadharcardPath,
        ...educationalDocsPaths,
        releaseLetterPath,
        offerLetterPath,
        experienceLetterPath,
        ...bankStatementOrSalarySlipPaths
      ].filter(Boolean);
      allFilePaths.forEach(filePath => {
        try {
          fs.unlinkSync(path.resolve(filePath));
        } catch (e) {
          // Ignore file delete errors
        }
      });
      return res.status(500).json({ message: err.message });
    }

    res.status(201).json({
      message: 'Employee record created successfully',
      employee: newEmployee
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Get all employees
export const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find();
    res.status(200).json({ employees });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Get employee by ID
export const getEmployeeById = async (req, res) => {
  try {
    const { empId } = req.params;
    const employee = await Employee.findOne({ empId: empId.toString() });

    if (!employee) {
      return res.status(404).json({ 
        success: false,
        message: `Employee with empId ${empId} not found` 
      });
    }

    res.status(200).json({ 
      success: true,
      employee 
    });
  } catch (err) {
    console.error('Error in getEmployeeById:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// 🔹 Update employee
export const updateEmployee = async (req, res) => {
  try {
    const { empId } = req.params;
    const employee = await Employee.findOne({ empId });

    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Update only provided fields
    Object.keys(req.body).forEach(key => {
      if (key === 'password') {
        // Hash new password if provided
        employee.password = bcrypt.hashSync(req.body.password, 10);
      } else {
        employee[key] = req.body[key];
      }
    });

    // Handle file uploads for identityDocs
    if (req.files && req.files.pancard) {
      employee.identityDocs.panCard = normalizePath(req.files.pancard[0].path);
    }
    if (req.files && req.files.aadharcard) {
      employee.identityDocs.aadharCard = normalizePath(req.files.aadharcard[0].path);
    }
    if (req.files && req.files.educationalDocs) {
      employee.identityDocs.educationalDocs = req.files.educationalDocs.map(f => normalizePath(f.path));
    }

    // Handle file uploads for previousCompanyDocs
    if (req.files && req.files.releaseLetter) {
      employee.previousCompanyDocs.releaseLetter = normalizePath(req.files.releaseLetter[0].path);
    }
    if (req.files && req.files.offerLetter) {
      employee.previousCompanyDocs.offerLetter = normalizePath(req.files.offerLetter[0].path);
    }
    if (req.files && req.files.experienceLetter) {
      employee.previousCompanyDocs.experienceLetter = normalizePath(req.files.experienceLetter[0].path);
    }
    if (req.files && req.files.bankStatementOrSalarySlip) {
      employee.previousCompanyDocs.bankStatementOrSalarySlip = req.files.bankStatementOrSalarySlip.map(f => normalizePath(f.path));
    }

    // Handle bankDetails
    if (req.body.accountHolderName) employee.bankDetails.accountHolderName = req.body.accountHolderName;
    if (req.body.accountNumber) employee.bankDetails.accountNumber = req.body.accountNumber;
    if (req.body.ifscCode) employee.bankDetails.ifscCode = req.body.ifscCode;

    await employee.save();

    res.status(200).json({
      message: 'Employee updated successfully',
      employee
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Delete employee
export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Employee.findByIdAndDelete(id);

    if (!deleted) return res.status(404).json({ message: 'Employee not found' });

    res.status(200).json({ message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Get employees by department
export const getEmployeesByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const employees = await Employee.find({ department });
    res.status(200).json({ employees });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Login employee
export const loginEmployee = async (req, res) => {
  try {
    const { empId, password } = req.body;
    if (!empId || !password) {
      return res.status(400).json({ message: 'empId and password are required' });
    }
    const employee = await Employee.findOne({ empId }).select('+password');
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Generate JWT token
    const token = jwt.sign({ empId: employee.empId, id: employee._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    // Remove password from response
    const employeeObj = employee.toObject();
    delete employeeObj.password;
    res.status(200).json({
      message: 'Login successful',
      token,
      employee: employeeObj
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 Update user status (active/inactive)
export const updateEmployeeStatus = async (req, res) => {
  try {
    const { empId } = req.params;
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    const employee = await Employee.findOneAndUpdate(
      { empId },
      { status },
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.status(200).json({ message: 'Status updated successfully', employee });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
