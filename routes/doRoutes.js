import express from 'express';
import { createDO, getDOByEmpId, getAllDO, getDOByDate, getDOByDateRange } from '../controllers/doController.js';

const router = express.Router();

// Create DO
router.post('/do', createDO);

// Get DOs by Employee ID
router.get('/do/employee/:empId', getDOByEmpId);

// Get all DOs
router.get('/do', getAllDO);

// Get DOs by date
router.get('/do/date', getDOByDate);

// Get DOs by date range
router.get('/do/daterange', getDOByDateRange);

export default router; 