import express from 'express';
import { 
  createDO, 
  getDOByEmpId, 
  getAllDO, 
  getDOByDate, 
  getDOByDateRange,
  updateDO,
  deleteDO,
  getDOById
} from '../controllers/doController.js';
import { isAuthenticatedUser } from '../middlewares/auth.js';
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

// Get DO by ID (parameterized route - must come last)
router.get('/do/:id', getDOById);

// Update DO
router.put('/do/:id', updateDO);

// Delete DO
router.delete('/do/:id', deleteDO);



export default router; 