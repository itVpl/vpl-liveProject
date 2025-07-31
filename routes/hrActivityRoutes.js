import express from 'express';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import {
  createHRCallActivity,
  createHREmailActivity,
  getAllHRActivities,
  getAllHRCallActivities,
  getAllHREmailActivities,
  getAllHRCallActivitiesByDate,
  getAllHREmailActivitiesByDate,
  getHREmailActivitiesByDate,
  getHRActivities,
  getHRActivityById,
  updateHRActivity,
  deleteHRActivity,
  getHRActivityStats,
  getHRActivityReports,
  getHRActivityByDate
} from '../controllers/hrActivityController.js';

const router = express.Router();

// 📞 POST: Create new HR call activity
router.post('/call/create', isAuthenticatedEmployee, createHRCallActivity);

// 📧 POST: Create new HR email activity
router.post('/email/create', isAuthenticatedEmployee, createHREmailActivity);

// 📞 GET: Get all HR call activities (no filters)
router.get('/call/all', isAuthenticatedEmployee, getAllHRCallActivities);

// 📧 GET: Get all HR email activities (no filters)
router.get('/email/all', isAuthenticatedEmployee, getAllHREmailActivities);

// 📧 GET: Get HR email activities by date
router.get('/email/date', isAuthenticatedEmployee, getHREmailActivitiesByDate);

// 📞 GET: Get all HR call activities by date
router.get('/call/date', isAuthenticatedEmployee, getAllHRCallActivitiesByDate);

// 📧 GET: Get all HR email activities by date
router.get('/email/date/all', isAuthenticatedEmployee, getAllHREmailActivitiesByDate);

// 📋 GET: Get all HR activities (no filters)
router.get('/all', isAuthenticatedEmployee, getAllHRActivities);

// 📋 GET: Get HR activities with filters
router.get('/list', isAuthenticatedEmployee, getHRActivities);

// 📊 GET: Get HR activity statistics
router.get('/stats', isAuthenticatedEmployee, getHRActivityStats);

// 📊 GET: Get HR activity reports (date-wise)
router.get('/reports', isAuthenticatedEmployee, getHRActivityReports);

// 📅 GET: Get HR activity for specific date only
router.get('/date', isAuthenticatedEmployee, getHRActivityByDate);

// 📞 GET: Get specific HR activity by ID
router.get('/:id', isAuthenticatedEmployee, getHRActivityById);

// 🔄 PUT: Update HR activity
router.put('/:id', isAuthenticatedEmployee, updateHRActivity);

// 🗑️ DELETE: Delete HR activity
router.delete('/:id', isAuthenticatedEmployee, deleteHRActivity);

export default router; 