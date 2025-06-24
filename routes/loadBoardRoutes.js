import express from 'express';
import {
    getLoadBoardDashboard,
    getLoadBoardFilters,
    getLoadBoardAnalytics,
    getLoadBoardNotifications,
} from '../controllers/loadBoardController.js';
import { isAuthenticatedUser } from '../middlewares/auth.js';

const loadBoardRouter = express.Router();

// Load Board Dashboard Routes
loadBoardRouter.get('/dashboard', getLoadBoardDashboard); // Public route
loadBoardRouter.get('/filters', getLoadBoardFilters); // Public route
loadBoardRouter.get('/analytics', getLoadBoardAnalytics); // Public route
loadBoardRouter.get('/notifications', isAuthenticatedUser, getLoadBoardNotifications);

export default loadBoardRouter; 