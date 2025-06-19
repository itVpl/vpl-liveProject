import express from 'express';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import { isHRDepartment } from '../middlewares/isHRDepartment.js';
import {
  generatePayroll,
  getAllPayrolls,
  getOwnPayroll,
  markAsPaid
} from '../controllers/payrollController.js';

const router = express.Router();

// HR/Admin access
router.post('/', isAuthenticatedEmployee, isHRDepartment, generatePayroll);
router.get('/', isAuthenticatedEmployee, isHRDepartment, getAllPayrolls);
router.patch('/:id/paid', isAuthenticatedEmployee, isHRDepartment, markAsPaid);

// Employee access
router.get('/me', isAuthenticatedEmployee, getOwnPayroll);

export default router;