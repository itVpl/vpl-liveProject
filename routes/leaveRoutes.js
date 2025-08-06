import express from 'express';
import { 
  applyLeave, 
  applyHalfDayLeave,
  applyHalfDayLeaveWithBalance,
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
  getCurrentMonthLeaves,
  // 🔹 New manager approval functions
  managerApproveLeave,
  hrFinalApproveLeave,
  getLeavesPendingManagerApproval,
  getLeavesPendingHRApproval
} from '../controllers/leaveController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import { isHRDepartment } from '../middlewares/isHRDepartment.js';

const router = express.Router();

// 📅 Basic Leave Operations
router.post('/apply', isAuthenticatedEmployee, applyLeave);
router.post('/apply-half-day', isAuthenticatedEmployee, applyHalfDayLeave);
router.get('/all', isAuthenticatedEmployee, isHRDepartment, getAllLeaves);
router.get('/current-month', isAuthenticatedEmployee, isHRDepartment, getCurrentMonthLeaves);
router.patch('/status/:id', isAuthenticatedEmployee, isHRDepartment, updateLeaveStatus);
router.get('/emp/:empId', isAuthenticatedEmployee, isHRDepartment, getLeavesByEmployee);
router.get('/my', isAuthenticatedEmployee, getMyLeaves);
router.get('/monthly-summary', isAuthenticatedEmployee, isHRDepartment, getMonthlyLeaveSummary);
router.delete('/cancel/:id', isAuthenticatedEmployee, cancelLeave);

// 🔹 Manager Approval Routes
router.get('/pending-manager-approval', isAuthenticatedEmployee, getLeavesPendingManagerApproval);
router.patch('/manager-approve/:id', isAuthenticatedEmployee, managerApproveLeave);

// 🔹 HR Final Approval Routes
router.get('/pending-hr-approval', isAuthenticatedEmployee, isHRDepartment, getLeavesPendingHRApproval);
router.patch('/hr-final-approve/:id', isAuthenticatedEmployee, isHRDepartment, hrFinalApproveLeave);

// 📊 Leave Balance Management
router.get('/balance/:empId', isAuthenticatedEmployee, isHRDepartment, getLeaveBalance);
router.get('/my-balance', isAuthenticatedEmployee, getMyLeaveBalance);
router.post('/apply-with-balance', isAuthenticatedEmployee, applyLeaveWithBalance);
router.post('/apply-half-day-with-balance', isAuthenticatedEmployee, applyHalfDayLeaveWithBalance);
router.patch('/update-balance/:empId', isAuthenticatedEmployee, isHRDepartment, updateLeaveBalance);

export default router;
