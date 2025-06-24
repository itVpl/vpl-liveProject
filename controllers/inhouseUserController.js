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

// Helper function to format date
const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

// 🔹 Create new employee
export const createEmployee = async (req, res) => {
  try {
    console.log('🔍 Request body:', req.body);
    console.log('📁 Request files:', req.files);
    
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

    console.log('📄 File paths:');
    console.log('Pan Card:', pancardPath);
    console.log('Aadhar Card:', aadharcardPath);
    console.log('Educational Docs:', educationalDocsPaths);
    console.log('Release Letter:', releaseLetterPath);
    console.log('Offer Letter:', offerLetterPath);
    console.log('Experience Letter:', experienceLetterPath);
    console.log('Bank Statement:', bankStatementOrSalarySlipPaths);

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
// export const loginEmployee = async (req, res) => {
//   try {
//     const { empId, password } = req.body;
//     if (!empId || !password) {
//       return res.status(400).json({ success: false, message: 'empId and password are required' });
//     }

//     const employee = await Employee.findOne({ empId }).select('+password');
//     if (!employee) {
//       return res.status(404).json({ success: false, message: 'Employee not found' });
//     }

//     const isMatch = await bcrypt.compare(password, employee.password);
//     if (!isMatch) {
//       return res.status(401).json({ success: false, message: 'Invalid credentials' });
//     }

//     const token = jwt.sign(
//       { empId: employee.empId, id: employee._id },
//       process.env.JWT_SECRET || 'secret',
//       { expiresIn: '7d' }
//     );

//     const now = new Date();
//     await UserActivity.create({
//       empId: employee.empId,
//       date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
//       loginTime: now,
//       status: 'active'
//     });

//     // ✅ Format login time
//     const formattedLoginTime = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1)
//       .toString()
//       .padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes()
//       .toString()
//       .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

//     // ✅ Send Email on Login
//     await sendEmail({
//       to: employee.email,
//       subject: `🔔 Login Alert - ${employee.employeeName}`,
//       html: loginTemplate({
//         name: employee.employeeName,
//         loginTime: formattedLoginTime
//       })
//     });

//     // ✅ Set Cookie
//     res.cookie('token', token, {
//       httpOnly: true,
//       expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//       sameSite: 'None',
//       secure: true,
//     });

//     res.status(200).json({
//       success: true,
//       employee: {
//         empId: employee.empId,
//         employeeName: employee.employeeName,
//         role: employee.role,
//         allowedModules: employee.allowedModules || []
//       }
//     });

//   } catch (err) {
//     console.error("Login error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// 🔹 Login employee
export const loginEmployee = async (req, res) => {
  try {
    const { empId, password } = req.body;
    if (!empId || !password) {
      return res.status(400).json({ success: false, message: 'empId and password are required' });
    }

    // Check if employee already logged in
    // const existingActiveSession = await UserActivity.findOne({
    //   empId,
    //   status: 'active'
    // });

    // if (existingActiveSession) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'You are already logged in from another device. Please logout first.'
    //   });
    // }

    const employee = await Employee.findOne({ empId }).select('+password');
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
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
      employee: {
        empId: employee.empId,
        employeeName: employee.employeeName,
        role: employee.role,
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
export const assignModulesFromMaster = async (req, res) => {
  const requestingUser = req.user;
  const { empId } = req.params;
  const { moduleIds } = req.body;

  if (!requestingUser || requestingUser.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Only superadmin can assign modules.' });
  }

  try {
    const employee = await Employee.findOneAndUpdate(
      { empId },
      { allowedModules: moduleIds },
      { new: true }
    ).populate('allowedModules');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Modules assigned successfully from master',
      employee
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




