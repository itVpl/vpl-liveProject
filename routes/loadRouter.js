import express from 'express';
import { 
    createLoad, 
    getAvailableLoads, 
    getShipperLoads, 
    getTruckerLoads,
    getLoadDetails,
    updateLoadStatus,
    cancelLoad,
    searchLoads,
    getLoadStats,
    testUserAuth,
    testLoadModel
} from '../controllers/loadController.js';
import { isAuthenticatedUser, isShipper } from '../middlewares/auth.js';

const loadRouter = express.Router();

// Load Board Routes (Public)
loadRouter.get('/available', getAvailableLoads); // Public route for load board
loadRouter.get('/search', searchLoads); // Public search route
loadRouter.get('/stats', getLoadStats); // Public stats route

// Test endpoints for debugging
loadRouter.get('/test-auth', isAuthenticatedUser, testUserAuth);
loadRouter.get('/test-model', testLoadModel); // Public test

// Load Management Routes (Protected) - Specific routes first
loadRouter.post('/create', isShipper, createLoad); // Only shippers can create loads
loadRouter.get('/shipper', isShipper, getShipperLoads); // Only shippers can view their loads
loadRouter.get('/trucker', isAuthenticatedUser, getTruckerLoads); // Truckers can view assigned loads

// Parameterized routes last
loadRouter.get('/:id', getLoadDetails); // Public route for load details
loadRouter.put('/:id/status', isAuthenticatedUser, updateLoadStatus); // Both can update status
loadRouter.delete('/:id', isShipper, cancelLoad); // Only shippers can cancel loads

export default loadRouter;