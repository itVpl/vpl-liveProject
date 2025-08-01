import express from 'express';
import { employeeUpload } from '../middlewares/upload.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeesByDepartment,
  loginEmployee,
  updateEmployeeStatus,
  logoutEmployee,
  getDailyActivityReport,
  getEmployeeActivityHistory,
  updateRoleAndModules,
  assignRoleToEmployee,
  assignModulesFromMaster,
  updateDocVerifiedStatus,
  createMeeting,
  getMeetings,
  getMeetingsByEmpId,
  unassignModulesFromMaster,
  getNewJoiners,
  getThisMonthBirthdays,
  updateEmployeeBasicSalary,
  getCMTDepartmentReport,
  getSalesDepartmentReport,
  updateTargetReason,
  getMonthlyProgress
} from '../controllers/inhouseUserController.js';
import { isHRDepartment } from '../middlewares/isHRDepartment.js';

const router = express.Router();

// 🔹 Create Employee
router.post('/', employeeUpload.fields([
  { name: 'pancard', maxCount: 1 },
  { name: 'aadharcard', maxCount: 1 },
  { name: 'educationalDocs', maxCount: 10 },
  { name: 'releaseLetter', maxCount: 1 },
  { name: 'offerLetter', maxCount: 1 },
  { name: 'experienceLetter', maxCount: 1 },
  { name: 'bankStatementOrSalarySlip', maxCount: 10 }
]), createEmployee);

// 🔹 Get All Employees
router.get('/', getAllEmployees);

// 🔹 Get new joiners count (last 15 days)
router.get('/new-joiners', isAuthenticatedEmployee, isHRDepartment, getNewJoiners);

// 🔹 Get this month birthdays
router.get('/birthdays', isAuthenticatedEmployee, isHRDepartment, getThisMonthBirthdays);

// 🔹 Get Single Employee by ID
router.get('/:empId', getEmployeeById);

// 🔹 Update Employee
router.put('/:empId', employeeUpload.fields([
  { name: 'pancard', maxCount: 1 },
  { name: 'aadharcard', maxCount: 1 },
  { name: 'educationalDocs', maxCount: 10 },
  { name: 'releaseLetter', maxCount: 1 },
  { name: 'offerLetter', maxCount: 1 },
  { name: 'experienceLetter', maxCount: 1 },
  { name: 'bankStatementOrSalarySlip', maxCount: 10 }
]), updateEmployee);

router.delete('/:id', deleteEmployee);
router.get('/department/:department', getEmployeesByDepartment);
router.post('/login', loginEmployee);
router.patch('/:empId/status', updateEmployeeStatus);
router.post('/logout', isAuthenticatedEmployee, logoutEmployee);

// New routes for activity reports
// router.get('/activity/daily', getDailyActivityReport);
router.get('/activity/daily', isAuthenticatedEmployee, isHRDepartment, getDailyActivityReport);
router.get('/activity/employee/:empId', getEmployeeActivityHistory);
router.patch('/:empId/role-modules', updateRoleAndModules);
router.patch('/assign-role/:empId', isAuthenticatedEmployee, assignRoleToEmployee);
router.patch('/assign-modules/:empId', isAuthenticatedEmployee, assignModulesFromMaster);
router.patch('/unassign-modules/:empId', isAuthenticatedEmployee, unassignModulesFromMaster);
router.patch('/:empId/doc-verified', isAuthenticatedEmployee, updateDocVerifiedStatus);

// Meeting scheduling routes
router.post('/meetings', isAuthenticatedEmployee, createMeeting);
router.get('/meetings', isAuthenticatedEmployee, getMeetings);
router.get('/meetings/employee/:empId', isAuthenticatedEmployee, getMeetingsByEmpId);

// 💰 Update employee basic salary (HR function)
router.patch('/:empId/basic-salary', isAuthenticatedEmployee, isHRDepartment, updateEmployeeBasicSalary);

// 📊 CMT Department Report - Date-wise talktime and trucker count
router.get('/cmt/report', isAuthenticatedEmployee, getCMTDepartmentReport);

// 📊 Sales Department Report - Date-wise talktime and delivery orders count
router.get('/sales/report', isAuthenticatedEmployee, getSalesDepartmentReport);

// 📝 Update reason for incomplete target
router.post('/target/reason', isAuthenticatedEmployee, updateTargetReason);

// 📊 Monthly Progress Report - Complete monthly performance analysis
router.get('/:empId/monthly-progress', isAuthenticatedEmployee, getMonthlyProgress);

export default router;
