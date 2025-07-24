import { Employee } from '../models/inhouseUserModel.js';
import { normalizePath } from '../middlewares/upload.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserActivity } from '../models/userActivityModel.js';
import { loginTemplate } from '../utils/templates/loginTemplate.js';
import { logoutTemplate } from '../utils/templates/logoutTemplate.js';
import { sendEmail } from '../utils/sendEmail.js';
import Meeting from '../models/Meeting.js';

// Helper function to format date
const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-').replace(',', '');
};

// 🔹 Create new employee
export const createEmployee = async (req, res) => {
  try {
    console.log('🔍 Request body:', req.body);
    console.log('📁 Request files:', req.files);
    
    const {
      empId,
      employeeName,
      aliasName,
      sex,
      dateOfBirth,
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

    // Helper function to parse date string to Date object
    const parseDate = (dateString) => {
      if (!dateString) return null;
      
      // Handle DD-MM-YYYY format
      if (typeof dateString === 'string' && dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
          // Assuming DD-MM-YYYY format
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Month is 0-indexed
          const year = parseInt(parts[2]);
          return new Date(year, month, day);
        }
      }
      
      // Try parsing as ISO string or other formats
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    // Parse date fields
    const parsedDateOfBirth = parseDate(dateOfBirth);
    const parsedDateOfJoining = parseDate(dateOfJoining);

    if (!parsedDateOfBirth) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid dateOfBirth format. Expected DD-MM-YYYY format.' 
      });
    }

    if (!parsedDateOfJoining) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid dateOfJoining format. Expected DD-MM-YYYY format.' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle file uploads for identityDocs
    const pancardPath = req.files && req.files.pancard ? (req.files.pancard[0].location || req.files.pancard[0].path) : undefined;
    const aadharcardPath = req.files && req.files.aadharcard ? (req.files.aadharcard[0].location || req.files.aadharcard[0].path) : undefined;
    const educationalDocsPaths = req.files && req.files.educationalDocs ? req.files.educationalDocs.map(f => f.location || f.path) : [];

    // Handle file uploads for previousCompanyDocs
    const releaseLetterPath = req.files && req.files.releaseLetter ? (req.files.releaseLetter[0].location || req.files.releaseLetter[0].path) : undefined;
    const offerLetterPath = req.files && req.files.offerLetter ? (req.files.offerLetter[0].location || req.files.offerLetter[0].path) : undefined;
    const experienceLetterPath = req.files && req.files.experienceLetter ? (req.files.experienceLetter[0].location || req.files.experienceLetter[0].path) : undefined;
    const bankStatementOrSalarySlipPaths = req.files && req.files.bankStatementOrSalarySlip ? req.files.bankStatementOrSalarySlip.map(f => f.location || f.path) : [];



    const newEmployeeData = {
      empId,
      employeeName,
      aliasName,
      sex,
      dateOfBirth: parsedDateOfBirth,
      email,
      mobileNo,
      alternateNo,
      emergencyNo,
      department,
      designation,
      dateOfJoining: parsedDateOfJoining,
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
      password: hashedPassword,
      agentIds: [empId] // Always set agentIds as array with empId
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
      
      // Delete local files if they exist
      allFilePaths.forEach(filePath => {
        if (filePath && !filePath.startsWith('http')) {
          try {
            fs.unlinkSync(path.resolve(filePath));
            console.log('Deleted local file:', filePath);
          } catch (e) {
            // Ignore file delete errors
          }
        }
      });
      
      // Log S3 files that would need cleanup
      const s3Files = allFilePaths.filter(filePath => filePath && filePath.startsWith('http'));
      if (s3Files.length > 0) {
        console.log('S3 files that may need cleanup:', s3Files);
      }
      return res.status(500).json({ success: false, message: err.message });
    }

    res.status(201).json({
      success: true,
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

    // Helper function to parse date string to Date object
    const parseDate = (dateString) => {
      if (!dateString) return null;
      
      // Handle DD-MM-YYYY format
      if (typeof dateString === 'string' && dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
          // Assuming DD-MM-YYYY format
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Month is 0-indexed
          const year = parseInt(parts[2]);
          return new Date(year, month, day);
        }
      }
      
      // Try parsing as ISO string or other formats
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    // Update only provided fields
    Object.keys(req.body).forEach(key => {
      if (key === 'password') {
        // Hash new password if provided
        employee.password = bcrypt.hashSync(req.body.password, 10);
      } else if (key === 'empId') {
        employee.empId = req.body.empId;
        employee.agentIds = [req.body.empId]; // Sync agentIds with empId
      } else if (key === 'dateOfBirth' || key === 'dateOfJoining') {
        // Parse date fields properly
        const parsedDate = parseDate(req.body[key]);
        if (parsedDate) {
          employee[key] = parsedDate;
        } else {
          throw new Error(`Invalid date format for ${key}. Expected DD-MM-YYYY format.`);
        }
      } else {
        employee[key] = req.body[key];
      }
    });

    // Handle file uploads for identityDocs
    if (req.files && req.files.pancard) {
      employee.identityDocs.panCard = req.files.pancard[0].location || req.files.pancard[0].path;
    }
    if (req.files && req.files.aadharcard) {
      employee.identityDocs.aadharCard = req.files.aadharcard[0].location || req.files.aadharcard[0].path;
    }
    if (req.files && req.files.educationalDocs) {
      employee.identityDocs.educationalDocs = req.files.educationalDocs.map(f => f.location || f.path);
    }

    // Handle file uploads for previousCompanyDocs
    if (req.files && req.files.releaseLetter) {
      employee.previousCompanyDocs.releaseLetter = req.files.releaseLetter[0].location || req.files.releaseLetter[0].path;
    }
    if (req.files && req.files.offerLetter) {
      employee.previousCompanyDocs.offerLetter = req.files.offerLetter[0].location || req.files.offerLetter[0].path;
    }
    if (req.files && req.files.experienceLetter) {
      employee.previousCompanyDocs.experienceLetter = req.files.experienceLetter[0].location || req.files.experienceLetter[0].path;
    }
    if (req.files && req.files.bankStatementOrSalarySlip) {
      employee.previousCompanyDocs.bankStatementOrSalarySlip = req.files.bankStatementOrSalarySlip.map(f => f.location || f.path);
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

    // ✅ 1. Required Field Validation
    if (!empId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and password are required',
        errors: {
          empId: !empId ? 'Employee ID is required' : null,
          password: !password ? 'Password is required' : null
        }
      });
    }

    // ✅ 2. Employee ID Format Validation (alphanumeric)
    const empIdRegex = /^[A-Za-z0-9]+$/;
    if (!empIdRegex.test(empId)) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID should contain only letters and numbers',
        errors: {
          empId: 'Invalid Employee ID format'
        }
      });
    }

    // ✅ 3. Password Length Validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
        errors: {
          password: 'Password must be at least 6 characters'
        }
      });
    }

    // ✅ 4. Employee ID Trim and Uppercase
    const cleanEmpId = empId.trim().toUpperCase();

    // ✅ 5. Find Employee
    const employee = await Employee.findOne({ empId: cleanEmpId }).select('+password');
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found with this ID',
        errors: {
          empId: 'No employee found with this ID'
        }
      });
    }

    // ✅ 6. Check Employee Status
    if (employee.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Your account is ${employee.status}. Please contact HR.`,
        errors: {
          empId: `Account is ${employee.status}`
        }
      });
    }

    // ✅ 7. Password Verification
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
        errors: {
          password: 'Incorrect password'
        }
      });
    }

    const token = jwt.sign(
      { empId: employee.empId, id: employee._id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    const now = new Date();
    await UserActivity.create({
      empId: employee.empId,
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      loginTime: now,
      status: 'active'
    });

    const formattedLoginTime = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    await sendEmail({
      to: employee.email,
      subject: `🔔 Login Alert - ${employee.employeeName}`,
      html: loginTemplate({
        name: employee.employeeName,
        loginTime: formattedLoginTime
      })
    });

    res.cookie('token', token, {
      httpOnly: true,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      sameSite: 'None',
      secure: true,
    });

    res.status(200).json({
      success: true,
      token: token,
      employee: {
        empId: employee.empId,
        employeeName: employee.employeeName,
        aliasName: employee.aliasName,
        role: employee.role,
        department: employee.department,
        designation: employee.designation,
        allowedModules: employee.allowedModules || []
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: err.message });
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

// New function to get daily activity report
export const getDailyActivityReport = async (req, res) => {
  try {
    const { date } = req.query;
    const queryDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate());
    const endOfDay = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate() + 1);

    const activities = await UserActivity.find({
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    }).sort({ loginTime: 1 });

    // Group activities by employee
    const report = activities.reduce((acc, activity) => {
      if (!acc[activity.empId]) {
        acc[activity.empId] = {
          empId: activity.empId,
          totalHours: 0,
          sessions: []
        };
      }

      if (activity.logoutTime) {
        acc[activity.empId].totalHours += activity.totalHours;
        acc[activity.empId].sessions.push({
          loginTime: formatDate(activity.loginTime),
          logoutTime: formatDate(activity.logoutTime),
          duration: activity.totalHours.toFixed(2) + ' hours'
        });
      }

      return acc;
    }, {});

    res.status(200).json({
      success: true,
      date: formatDate(startOfDay),
      report: Object.values(report)
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// New function to get employee's activity history
export const getEmployeeActivityHistory = async (req, res) => {
  try {
    const { empId } = req.params;
    const { startDate, endDate } = req.query;

    const query = { empId };
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const activities = await UserActivity.find(query)
      .sort({ date: -1, loginTime: -1 });

    // Format the activities
    const formattedActivities = activities.map(activity => ({
      ...activity.toObject(),
      date: formatDate(activity.date),
      loginTime: formatDate(activity.loginTime),
      logoutTime: activity.logoutTime ? formatDate(activity.logoutTime) : null,
      totalHours: activity.totalHours ? activity.totalHours.toFixed(2) + ' hours' : null
    }));

    res.status(200).json({
      success: true,
      empId,
      activities: formattedActivities
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 🔹 Update Role and Allowed Modules
export const updateRoleAndModules = async (req, res) => {
  try {
    const { empId } = req.params;
    const { role, allowedModules } = req.body;

    if (!['superadmin', 'admin', 'employee'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const employee = await Employee.findOneAndUpdate(
      { empId },
      { role, allowedModules },
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Role and allowed modules updated successfully',
      employee
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔒 Assign role to an employee — Superadmin only
export const assignRoleToEmployee = async (req, res) => {
  try {
    const requestingUser = req.user; // comes from auth middleware
    const { empId } = req.params;
    const { role } = req.body;

    if (!requestingUser || requestingUser.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only superadmin can assign roles.' });
    }

    if (!['employee', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be "employee" or "admin".' });
    }

    const employee = await Employee.findOne({ empId });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    // ⚠️ Already has same role
    if (employee.role === role) {
      return res.status(200).json({
        success: true,
        message: `Employee already has role '${role}'`
      });
    }

    // ✅ Assign role
    employee.role = role;
    await employee.save();

    return res.status(200).json({
      success: true,
      message: `Role updated to ${role} for ${empId}`
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 🔒 Superadmin assigns allowed modules from ModuleMaster

// export const assignModulesFromMaster = async (req, res) => {
//   const requestingUser = req.user;
//   const { empId } = req.params;
//   const { moduleIds } = req.body;

//   if (!requestingUser || requestingUser.role !== 'superadmin') {
//     return res.status(403).json({ success: false, message: 'Only superadmin can assign modules.' });
//   }

//   try {
//     const employee = await Employee.findOneAndUpdate(
//       { empId },
//       { allowedModules: moduleIds },
//       { new: true }
//     ).populate('allowedModules');

//     if (!employee) {
//       return res.status(404).json({ success: false, message: 'Employee not found' });
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Modules assigned successfully from master',
//       employee
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };


export const assignModulesFromMaster = async (req, res) => {
  const requestingUser = req.user;
  const { empId } = req.params;
  const { moduleIds } = req.body;

  if (!requestingUser || requestingUser.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Only superadmin can assign modules.' });
  }

  try {
    const employee = await Employee.findOne({ empId });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const current = employee.allowedModules.map((id) => id.toString());
    const incoming = moduleIds.map((id) => id.toString());

    // 🔁 Merge unique module IDs
    const merged = Array.from(new Set([...current, ...incoming]));
    employee.allowedModules = merged;

    await employee.save();

    const populatedEmployee = await Employee.findOne({ empId }).populate('allowedModules');

    res.status(200).json({
      success: true,
      message: 'Modules assigned successfully from master',
      employee: populatedEmployee,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔒 HR or Admin manually verifies doc status
export const updateDocVerifiedStatus = async (req, res) => {
  try {
    const { empId } = req.params;
    const { docVerified } = req.body;

    if (typeof docVerified !== 'boolean') {
      return res.status(400).json({ success: false, message: "docVerified must be true or false" });
    }

    const employee = await Employee.findOneAndUpdate(
      { empId },
      { docVerified },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.status(200).json({
      success: true,
      message: `Document verification status updated to ${docVerified}`,
      empId: employee.empId,
      docVerified: employee.docVerified
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const logoutEmployee = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'You are already logged out'
      });
    }

    const empId = req.user.empId;
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const activity = await UserActivity.findOne({
      empId,
      date: today,
      status: 'active'
    });

    let formattedLogoutTime = null;
    let employeeEmail = null;
    let employeeName = null;

    if (activity) {
      activity.logoutTime = now;
      activity.status = 'completed';
      const hours = (now - activity.loginTime) / (1000 * 60 * 60);
      activity.totalHours = parseFloat(hours.toFixed(2));
      await activity.save();

      // Format time for email
      formattedLogoutTime = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1)
        .toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes()
        .toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      // Get email & name for the employee
      const { email, employeeName: name } = req.user;
      employeeEmail = email;
      employeeName = name;
    }

    // Clear cookie
    res.cookie('token', null, {
      expires: new Date(Date.now()),
      httpOnly: true,
      sameSite: 'strict'
    });

    // ✅ Send Logout Email
    if (employeeEmail && employeeName && formattedLogoutTime) {
      await sendEmail({
        to: employeeEmail,
        subject: `🚪 Logout Alert - ${employeeName}`,
        html: logoutTemplate({
          name: employeeName,
          logoutTime: formattedLogoutTime
        })
      });
    }

    res.status(200).json({
      success: true,
      message: `Logout successful for employee ${empId}`
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Schedule a new meeting
export const createMeeting = async (req, res) => {
  try {
    const { meetingDate, meetingTime, subject, location } = req.body;
    if (!meetingDate || !meetingTime || !subject) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const meeting = await Meeting.create({
      user: req.user._id,
      meetingDate,
      meetingTime,
      subject,
      location
    });
    res.status(201).json({ success: true, meeting });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to schedule meeting', error: error.message });
  }
};

// getMeetings Controller (Recommended)
export const getMeetings = async (req, res) => {
  try {
    const empId = req.user.empId; // fetched from token/middleware
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({ success: false, message: `Employee with empId ${empId} not found` });
    }

    const meetings = await Meeting.find({ empId });
    return res.status(200).json({ success: true, meetings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get all meetings for a given employee by empId (for admin/HR)
export const getMeetingsByEmpId = async (req, res) => {
  try {
    const { empId } = req.params;
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({ success: false, message: `Employee with empId ${empId} not found` });
    }
    const meetings = await Meeting.find({ user: employee._id }).sort({ meetingDate: 1, meetingTime: 1 });
    return res.status(200).json({ success: true, meetings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 🔒 Superadmin unassigns allowed modules from ModuleMaster
export const unassignModulesFromMaster = async (req, res) => {
  const requestingUser = req.user;
  const { empId } = req.params;
  const { moduleIds } = req.body;

  if (!requestingUser || requestingUser.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Only superadmin can unassign modules.' });
  }

  try {
    const employee = await Employee.findOneAndUpdate(
      { empId },
      { $pull: { allowedModules: { $in: moduleIds } } },
      { new: true }
    ).populate('allowedModules');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Modules unassigned successfully from master',
      employee
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get new joiners count (last 15 days)
export const getNewJoiners = async (req, res) => {
  try {
    const currentDate = new Date();
    const fifteenDaysAgo = new Date(currentDate.getTime() - (15 * 24 * 60 * 60 * 1000));

    console.log('🔍 Debug - New joiners filter:', {
      currentDate,
      fifteenDaysAgo,
      daysBack: 15
    });

    const newJoiners = await Employee.find({
      dateOfJoining: {
        $gte: fifteenDaysAgo,
        $lte: currentDate
      }
    }).select('empId employeeName department designation dateOfJoining');

    console.log('🔍 Debug - New joiners found:', newJoiners.length);

    res.status(200).json({
      success: true,
      message: 'New joiners count retrieved successfully',
      totalNewJoiners: newJoiners.length,
      daysBack: 15,
      fromDate: fifteenDaysAgo,
      toDate: currentDate,
      newJoiners: newJoiners
    });

  } catch (error) {
    console.error('❌ Error in getNewJoiners:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving new joiners count',
      error: error.message
    });
  }
};

// 🔹 Get this month birthdays
export const getThisMonthBirthdays = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12

    console.log('🔍 Debug - Birthday filter:', {
      currentDate,
      currentMonth,
      currentYear: currentDate.getFullYear()
    });

    // Find employees whose birthday month matches current month
    const employees = await Employee.find({
      $expr: {
        $eq: [
          { $month: { $dateFromString: { dateString: "$dateOfBirth" } } },
          currentMonth
        ]
      }
    }).select('empId employeeName department designation dateOfBirth email mobileNo');

    // Sort by day of month
    const sortedEmployees = employees.sort((a, b) => {
      const dayA = new Date(a.dateOfBirth).getDate();
      const dayB = new Date(b.dateOfBirth).getDate();
      return dayA - dayB;
    });

    console.log('🔍 Debug - Birthday employees found:', sortedEmployees.length);

    // Add today's birthdays flag
    const today = currentDate.getDate();
    const employeesWithTodayFlag = sortedEmployees.map(emp => {
      const birthDay = new Date(emp.dateOfBirth).getDate();
      return {
        ...emp.toObject(),
        isToday: birthDay === today,
        daysUntilBirthday: birthDay >= today ? birthDay - today : (30 - today) + birthDay
      };
    });

    res.status(200).json({
      success: true,
      message: 'This month birthdays retrieved successfully',
      currentMonth: currentMonth,
      currentYear: currentDate.getFullYear(),
      totalBirthdays: employeesWithTodayFlag.length,
      todayBirthdays: employeesWithTodayFlag.filter(emp => emp.isToday).length,
      employees: employeesWithTodayFlag
    });

  } catch (error) {
    console.error('❌ Error in getThisMonthBirthdays:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving this month birthdays',
      error: error.message
    });
  }
};




