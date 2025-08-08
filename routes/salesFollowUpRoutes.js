import express from 'express';
import {
  createSalesFollowUp,
  getAllSalesFollowUps,
  getSalesFollowUpById,
  updateSalesFollowUp,
  addFollowUpEntry,
  updateFollowUpEntry,
  deleteSalesFollowUp,
  getMySalesFollowUps,
  getSalesFollowUpStats,
  searchSalesFollowUps,
  checkEmailExists
} from '../controllers/salesFollowUpController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';

const salesFollowUpRouter = express.Router();

// Create new sales follow-up
salesFollowUpRouter.post('/create', isAuthenticatedEmployee, createSalesFollowUp);

// Get all sales follow-ups with filters
salesFollowUpRouter.get('/all', isAuthenticatedEmployee, getAllSalesFollowUps);

// Get my sales follow-ups (current employee's follow-ups)
salesFollowUpRouter.get('/my-followups', isAuthenticatedEmployee, getMySalesFollowUps);

// Get sales follow-up by ID
salesFollowUpRouter.get('/:id', isAuthenticatedEmployee, getSalesFollowUpById);

// Update sales follow-up
salesFollowUpRouter.put('/:id', isAuthenticatedEmployee, updateSalesFollowUp);

// Add follow-up entry
salesFollowUpRouter.post('/:id/followup', isAuthenticatedEmployee, addFollowUpEntry);

// Update follow-up entry
salesFollowUpRouter.put('/:id/followup/:followUpId', isAuthenticatedEmployee, updateFollowUpEntry);

// Delete sales follow-up
salesFollowUpRouter.delete('/:id', isAuthenticatedEmployee, deleteSalesFollowUp);

// Get sales follow-up statistics
salesFollowUpRouter.get('/stats/overview', isAuthenticatedEmployee, getSalesFollowUpStats);

// Search sales follow-ups
salesFollowUpRouter.get('/search/term', isAuthenticatedEmployee, searchSalesFollowUps);

// Check if email exists
salesFollowUpRouter.get('/check-email', isAuthenticatedEmployee, checkEmailExists);

export default salesFollowUpRouter; 