import express from 'express';
import { 
  createDO, 
  getDOByEmpId, 
  getAllDO, 
  getDOByDate, 
  getDOByDateRange,
  updateDO,
  deleteDO,
  getDOById,
  fixCarrierFees,
  // 🔥 NEW: Assignment functions
  getAvailableCMTUsers,
  assignDOToCMT,
  getDOsAssignedToCMT,
  updateAssignmentStatus,
  getDOsCreatedBySalesUser
} from '../controllers/doController.js';
import { isAuthenticatedUser, isAuthenticatedEmployee } from '../middlewares/auth.js';
import { doCreateUpload } from '../middlewares/upload.js';

const router = express.Router();

// Apply authentication middleware to all DO routes
router.use(isAuthenticatedUser);

// Create DO with file upload
router.post('/do', doCreateUpload, createDO);

// Get all DOs
router.get('/do', getAllDO);

// Get DOs by date (specific route - must come before /:id)
router.get('/do/date', getDOByDate);

// Get DOs by date range (specific route - must come before /:id)
router.get('/do/daterange', getDOByDateRange);

// Get DOs by Employee ID (specific route - must come before /:id)
router.get('/do/employee/:empId', getDOByEmpId);

// 🔥 NEW: Assignment routes (use employee authentication)
// Get available CMT users for assignment (Sales only)
router.get('/do/available-cmt-users', isAuthenticatedEmployee, getAvailableCMTUsers);

// Assign delivery order to CMT user (Sales only)
router.post('/do/assign-to-cmt', isAuthenticatedEmployee, assignDOToCMT);

// Get delivery orders assigned to CMT user (CMT only)
router.get('/do/assigned-to-cmt', isAuthenticatedEmployee, getDOsAssignedToCMT);

// Update assignment status (CMT only)
router.put('/do/update-assignment-status', isAuthenticatedEmployee, updateAssignmentStatus);

// Get delivery orders created by sales user (Sales only)
router.get('/do/created-by-sales', isAuthenticatedEmployee, getDOsCreatedBySalesUser);

// Get DO by ID (parameterized route - must come last)
router.get('/do/:id', getDOById);

// Update DO
router.put('/do/:id', updateDO);

// Delete DO
router.delete('/do/:id', deleteDO);

// Fix carrier fees for all DOs
router.post('/do/fix-carrier-fees', fixCarrierFees);

export default router; 