import express from 'express';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import {
  createHRActivity,
  getAllHRActivities,
  getHRActivities,
  getHRActivityById,
  updateHRActivity,
  deleteHRActivity,
  getHRActivityStats
} from '../controllers/hrActivityController.js';

const router = express.Router();

// 📞 POST: Create new HR call activity
router.post('/create', isAuthenticatedEmployee, createHRActivity);

// 📋 GET: Get all HR activities (no filters)
router.get('/all', isAuthenticatedEmployee, getAllHRActivities);

// 📋 GET: Get HR activities with filters
router.get('/list', isAuthenticatedEmployee, getHRActivities);

// 📊 GET: Get HR activity statistics
router.get('/stats', isAuthenticatedEmployee, getHRActivityStats);

// 📞 GET: Get specific HR activity by ID
router.get('/:id', isAuthenticatedEmployee, getHRActivityById);

// 🔄 PUT: Update HR activity
router.put('/:id', isAuthenticatedEmployee, updateHRActivity);

// 🗑️ DELETE: Delete HR activity
router.delete('/:id', isAuthenticatedEmployee, deleteHRActivity);

export default router; 