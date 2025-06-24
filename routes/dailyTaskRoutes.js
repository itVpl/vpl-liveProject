import express from 'express';
import {
  assignDailyTasks,
  updateTaskProgress,
  getMyTodayTasks
} from '../controllers/dailyTaskController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';

const router = express.Router();

// Assign tasks (triggered on login or manually)
router.post('/assign', isAuthenticatedEmployee, assignDailyTasks);

// Update specific task
router.put('/update', isAuthenticatedEmployee, updateTaskProgress);

// Get today's assigned tasks
router.get('/my', isAuthenticatedEmployee, getMyTodayTasks);

export default router;
