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
  getDriverDetailsById,
  logoutDriver,  // ✅ Added logoutDriver import
  logoutDriverById // ✅ Added logoutDriverById import
} from '../controllers/driverController.js';

import {
  isAuthenticatedUser,
  isAuthenticatedDriver
} from '../middlewares/auth.js';

import { driverRegisterUpload } from '../middlewares/upload.js';

const driverRouter = express.Router();

// ✅ Public routes
driverRouter.post('/login', loginDriver);
driverRouter.get('/details/:driverId', getDriverDetailsById);

// ✅ Truckers only
driverRouter.post('/register', isAuthenticatedUser, driverRegisterUpload, registerDriver);
driverRouter.get('/my-drivers', isAuthenticatedUser, getDriversByTrucker);

// ✅ Driver shipments by ID (no auth required)
driverRouter.get('/my-shipments/:driverId', getAssignedShipments);

// ✅ Driver-only routes (with auth)
driverRouter.get('/me', isAuthenticatedDriver, getMyProfile);

// ✅ Mark arrival (driver-only route)
// driverRouter.post(
//   '/mark-arrival/:loadId',
//   isAuthenticatedDriver,       // ✅ updated
//   arrivalUpload,
//   markArrivalAndUpload
// );

// If you want to keep the route but without file upload, use:
driverRouter.post('/mark-arrival/:loadId/:driverId', markArrivalAndUpload);

// ✅ Driver CRUD (driver-only)
driverRouter.get('/:id', isAuthenticatedUser, getDriverById);
driverRouter.put('/:id', isAuthenticatedUser, updateDriver);
driverRouter.delete('/:id', isAuthenticatedUser, deleteDriver);

// ✅ Driver logout
driverRouter.post('/logout', isAuthenticatedDriver, logoutDriver);

// ✅ Logout by driverId (for debug/testing only)
driverRouter.post('/logout-by-id', logoutDriverById);

// ✅ Admin - get all drivers
driverRouter.get('/all', isAuthenticatedUser, getAllDrivers);

export default driverRouter;

