import express from 'express';
import { 
    registerDriver, 
    loginDriver, 
    getAllDrivers, 
    getDriverById, 
    updateDriver, 
    deleteDriver,
    getDriversByTrucker,
    getAssignedShipments,
    markArrivalAndUpload,
    getMyProfile,
    getDriverDetailsById
} from '../controllers/driverController.js';
import { isAuthenticatedUser } from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';

const driverRouter = express.Router();

// Public routes
driverRouter.post('/login', loginDriver);
driverRouter.get('/details/:driverId', getDriverDetailsById);

// Protected routes - Only truckers can access
driverRouter.post('/register', isAuthenticatedUser, registerDriver);
driverRouter.get('/my-drivers', isAuthenticatedUser, getDriversByTrucker); 
driverRouter.get('/my-shipments', isAuthenticatedUser, getAssignedShipments);
driverRouter.post('/mark-arrival/:loadId', isAuthenticatedUser, upload.array('images'), markArrivalAndUpload);
driverRouter.get('/:id', isAuthenticatedUser, getDriverById);
driverRouter.put('/:id', isAuthenticatedUser, updateDriver);
driverRouter.delete('/:id', isAuthenticatedUser, deleteDriver);

// Driver-only routes
driverRouter.get('/me', isAuthenticatedUser, getMyProfile);

// Admin routes - For admin/super admin to see all drivers
driverRouter.get('/all', isAuthenticatedUser, getAllDrivers);

export default driverRouter;