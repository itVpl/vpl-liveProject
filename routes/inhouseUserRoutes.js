import express from 'express';
import employeeUpload from '../middlewares/upload.js';
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeesByDepartment
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

// 🔹 Delete Employee
router.delete('/:id', deleteEmployee);

// 🔹 Get Employees by Department
router.get('/department/:department', getEmployeesByDepartment);

export default router;
