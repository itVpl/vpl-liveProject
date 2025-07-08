import express from 'express';
import {
  getAllAttendance,
  getEmployeeAttendance,
  markAbsentEmployees,
  getAttendanceByDateRange,
  getMyAttendance,
  getUserLast30DaysAttendance,
  getUserPresentDaysCount,
  getUserPresentDaysCountCurrentMonth
} from '../controllers/attendanceController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import { isHRDepartment } from '../middlewares/isHRDepartment.js';

const router = express.Router();

// Employee access - must come before parameterized routes
router.get('/my', isAuthenticatedEmployee, getMyAttendance);
router.get('/my/last30days', isAuthenticatedEmployee, getUserLast30DaysAttendance);
router.get('/my/present-count', isAuthenticatedEmployee, getUserPresentDaysCount);
router.get('/my/present-count-current-month', isAuthenticatedEmployee, getUserPresentDaysCountCurrentMonth);

// HR/Admin access
router.get('/', isAuthenticatedEmployee, isHRDepartment, getAllAttendance);
router.get('/range', isAuthenticatedEmployee, isHRDepartment, getAttendanceByDateRange);
router.get('/:empId', isAuthenticatedEmployee, isHRDepartment, getEmployeeAttendance);
router.post('/mark-absent', isAuthenticatedEmployee, isHRDepartment, markAbsentEmployees);

export default router;
