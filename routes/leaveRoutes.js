import express from 'express';
import { 
  applyLeave, 
  updateLeaveStatus, 
  getAllLeaves, 
  getLeavesByEmployee, 
  getMyLeaves, 
  getMonthlyLeaveSummary, 
  cancelLeave,
  getLeaveBalance,
  applyLeaveWithBalance,
  getMyLeaveBalance,
  updateLeaveBalance,
  getCurrentMonthLeaves
} from '../controllers/leaveController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import { isHRDepartment } from '../middlewares/isHRDepartment.js';

const router = express.Router();

// 📅 Basic Leave Operations
router.post('/apply', isAuthenticatedEmployee, applyLeave);
router.get('/all', isAuthenticatedEmployee, isHRDepartment, getAllLeaves);
router.get('/current-month', isAuthenticatedEmployee, isHRDepartment, getCurrentMonthLeaves);
router.patch('/status/:id', isAuthenticatedEmployee, isHRDepartment, updateLeaveStatus);
router.get('/emp/:empId', isAuthenticatedEmployee, isHRDepartment, getLeavesByEmployee);
router.get('/my', isAuthenticatedEmployee, getMyLeaves);
router.get('/monthly-summary', isAuthenticatedEmployee, isHRDepartment, getMonthlyLeaveSummary);
router.delete('/cancel/:id', isAuthenticatedEmployee, cancelLeave);

// 📊 Leave Balance Management
router.get('/balance/:empId', isAuthenticatedEmployee, isHRDepartment, getLeaveBalance);
router.get('/my-balance', isAuthenticatedEmployee, getMyLeaveBalance);
router.post('/apply-with-balance', isAuthenticatedEmployee, applyLeaveWithBalance);
router.patch('/update-balance/:empId', isAuthenticatedEmployee, isHRDepartment, updateLeaveBalance);



export default router;
