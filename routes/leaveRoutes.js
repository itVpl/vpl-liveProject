import express from 'express';
import { applyLeave, updateLeaveStatus, getAllLeaves, getLeavesByEmployee } from '../controllers/leaveController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import { isHRDepartment } from '../middlewares/isHRDepartment.js';

const router = express.Router();

router.post('/apply', isAuthenticatedEmployee, applyLeave);
router.get('/all', isAuthenticatedEmployee, isHRDepartment, getAllLeaves);
router.patch('/status/:id', isAuthenticatedEmployee, isHRDepartment, updateLeaveStatus);
router.get('/emp/:empId', isAuthenticatedEmployee, isHRDepartment, getLeavesByEmployee);



export default router;
