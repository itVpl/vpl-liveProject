import express from 'express';
import employeeUpload from '../middlewares/upload.js';
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
  assignRoleToEmployee
} from '../controllers/inhouseUserController.js';

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
router.get('/activity/daily', getDailyActivityReport);
router.get('/activity/employee/:empId', getEmployeeActivityHistory);
router.patch('/:empId/role-modules', updateRoleAndModules);
router.patch('/assign-role/:empId', isAuthenticatedEmployee, assignRoleToEmployee);


export default router;
