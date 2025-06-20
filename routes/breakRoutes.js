import express from 'express';
import { 
  startBreak, 
  endBreak, 
  getMyBreakHistory, 
  getAllBreaks, 
  getOverdueBreaks 
} from '../controllers/breakController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import { isHRDepartment } from '../middlewares/isHRDepartment.js';

const router = express.Router();

// Employee routes
router.post('/start', isAuthenticatedEmployee, startBreak);
router.post('/end', isAuthenticatedEmployee, endBreak);
router.get('/my-history', isAuthenticatedEmployee, getMyBreakHistory);

// Admin/HR routes
router.get('/', isAuthenticatedEmployee, isHRDepartment, getAllBreaks);
router.get('/overdue', isAuthenticatedEmployee, isHRDepartment, getOverdueBreaks);

export default router;