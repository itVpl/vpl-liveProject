import express from 'express';
import employeeUpload from '../middlewares/upload.js';
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee
} from '../controllers/inhouseUserController.js';

const router = express.Router();

// 🔹 Create Employee
router.post('/', employeeUpload.fields([
  { name: 'pancard', maxCount: 1 },
  { name: 'aadharcard', maxCount: 1 },
  { name: 'educationalDocs', maxCount: 10 }
]), createEmployee);

// 🔹 Get All Employees
router.get('/', getAllEmployees);

// 🔹 Get Single Employee by ID
router.get('/:empId', getEmployeeById);

// 🔹 Update Employee
router.put('/:id', employeeUpload.fields([
  { name: 'pancard', maxCount: 1 },
  { name: 'aadharcard', maxCount: 1 },
  { name: 'educationalDocs', maxCount: 10 }
]), updateEmployee);

// 🔹 Delete Employee
router.delete('/:id', deleteEmployee);

export default router;
