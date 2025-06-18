import express from 'express';
import {
  assignTarget,
  getTargetsByEmployee,
  updateTargetStatus,
  getAllTargets
} from '../controllers/targetController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';

const router = express.Router();

router.post('/assign', isAuthenticatedEmployee, assignTarget);
router.get('/:empId', isAuthenticatedEmployee, getTargetsByEmployee);
router.patch('/:id/status', isAuthenticatedEmployee, updateTargetStatus);
router.get('/', isAuthenticatedEmployee, getAllTargets); 


export default router;
