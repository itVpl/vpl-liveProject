import express from 'express';
import {
  createDayTarget,
  getAllDayTargets,
  getDayTargetsByEmployee,
  getTodayTarget,
  updateTargetProgress,
  updateTargetStatus,
  getDepartmentPerformance,
  deleteDayTarget,
  bulkCreateTargets,
  updateDeliveryOrderProgress
} from '../controllers/dayTargetController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import { isSuperAdmin } from '../middlewares/isSuperAdmin.js';
import { isHRDepartment } from '../middlewares/isHRDepartment.js';

const router = express.Router();

// 🎯 Create new daily target (Admin/HR/Superadmin only)
router.post('/create', isAuthenticatedEmployee, createDayTarget);

// 📋 Get all day targets (with filters)
router.get('/', isAuthenticatedEmployee, getAllDayTargets);

// 👤 Get day targets by specific employee
router.get('/employee/:empId', isAuthenticatedEmployee, getDayTargetsByEmployee);

// 📅 Get today's target for employee
router.get('/today/:empId', isAuthenticatedEmployee, getTodayTarget);

// ✅ Update target progress (Employee can update their own progress)
router.patch('/progress/:targetId', isAuthenticatedEmployee, updateTargetProgress);

// 🚚 Update delivery order progress (Sales employees)
router.patch('/delivery-orders/:targetId', isAuthenticatedEmployee, updateDeliveryOrderProgress);

// 🔄 Update target status (Admin/HR/Superadmin only)
router.patch('/status/:targetId', isAuthenticatedEmployee, updateTargetStatus);

// 📊 Get department performance report (Admin/HR/Superadmin only)
router.get('/performance', isAuthenticatedEmployee, getDepartmentPerformance);

// 🗑️ Delete target (Admin/HR/Superadmin only)
router.delete('/:targetId', isAuthenticatedEmployee, deleteDayTarget);

// 🔄 Bulk create targets for department (Admin/HR/Superadmin only)
router.post('/bulk-create', isAuthenticatedEmployee, bulkCreateTargets);

export default router; 