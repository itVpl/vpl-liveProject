import express from 'express';
import {
    getLoadBoardDashboard,
    getLoadBoardFilters,
    getLoadBoardAnalytics,
    getLoadBoardNotifications,
    getCompletedLoadsReport,
    getDeliveryDelaysReport,
    exportCompletedLoadsExcel,
    exportDeliveryDelaysExcel,
    exportCompletedLoadsPDF,
    exportDeliveryDelaysPDF,
} from '../controllers/loadBoardController.js';
import { isAuthenticatedUser } from '../middlewares/auth.js';

const loadBoardRouter = express.Router();

// Load Board Dashboard Routes
loadBoardRouter.get('/dashboard', getLoadBoardDashboard); // Public route
loadBoardRouter.get('/filters', getLoadBoardFilters); // Public route
loadBoardRouter.get('/analytics', getLoadBoardAnalytics); // Public route
loadBoardRouter.get('/notifications', isAuthenticatedUser, getLoadBoardNotifications);
loadBoardRouter.get('/reports/completed-loads', getCompletedLoadsReport); // Completed loads report
loadBoardRouter.get('/reports/delivery-delays', getDeliveryDelaysReport); // Delivery delays report
loadBoardRouter.get('/reports/completed-loads/excel', exportCompletedLoadsExcel); // Completed loads Excel export
loadBoardRouter.get('/reports/delivery-delays/excel', exportDeliveryDelaysExcel); // Delivery delays Excel export
loadBoardRouter.get('/reports/completed-loads/pdf', exportCompletedLoadsPDF); // Completed loads PDF export
loadBoardRouter.get('/reports/delivery-delays/pdf', exportDeliveryDelaysPDF); // Delivery delays PDF export

export default loadBoardRouter; 