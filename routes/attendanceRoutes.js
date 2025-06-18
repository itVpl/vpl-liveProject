import express from 'express';
import {
  getAllAttendance,
  getEmployeeAttendance,
  markAbsentEmployees
} from '../controllers/attendanceController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import { isHRDepartment } from '../middlewares/isHRDepartment.js';

const router = express.Router();

router.get('/', isAuthenticatedEmployee, isHRDepartment, getAllAttendance);
router.get('/:empId', isAuthenticatedEmployee, isHRDepartment, getEmployeeAttendance);
router.post('/mark-absent', isAuthenticatedEmployee, isHRDepartment, markAbsentEmployees);

export default router;
