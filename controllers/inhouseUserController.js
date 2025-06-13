import Employee from '../models/inhouseUserModel.js';
import { normalizePath } from '../middlewares/upload.js';

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
      identityDocs,
      previousCompanyDocs,
      bankDetails
    } = req.body;

    // Handle file uploads
    const pancardPath = req.files && req.files.pancard ? normalizePath(req.files.pancard[0].path) : (req.body.pancard || undefined);
    const aadharcardPath = req.files && req.files.aadharcard ? normalizePath(req.files.aadharcard[0].path) : (req.body.aadharcard || undefined);
    const educationalDocsPaths = req.files && req.files.educationalDocs ? req.files.educationalDocs.map(f => normalizePath(f.path)) : (req.body.educationalDocs || []);

    const newEmployee = await Employee.create({
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
      previousCompanyDocs,
      bankDetails
    });

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
    const { id } = req.params;
    // Handle file uploads for update
    let update = { ...req.body };
    if (!update.identityDocs) update.identityDocs = {};
    if (req.files && req.files.pancard) {
      update.identityDocs.panCard = normalizePath(req.files.pancard[0].path);
    }
    if (req.files && req.files.aadharcard) {
      update.identityDocs.aadharCard = normalizePath(req.files.aadharcard[0].path);
    }
    if (req.files && req.files.educationalDocs) {
      update.identityDocs.educationalDocs = req.files.educationalDocs.map(f => normalizePath(f.path));
    }
    const updatedEmployee = await Employee.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true
    });

    if (!updatedEmployee) return res.status(404).json({ message: 'Employee not found' });

    res.status(200).json({
      message: 'Employee updated successfully',
      employee: updatedEmployee
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
