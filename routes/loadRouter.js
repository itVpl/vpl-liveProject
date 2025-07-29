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
    testLoadModel,
    uploadProofOfDelivery,
    approveDelivery,
    createTrackingForLoad,
    getAllTrackings,
    getTrackingByShipmentNumber,
    updateLoadsWithGeocoding,
    uploadPickupImages,
    uploadLoadedTruckImages,
    uploadPODImages,
    uploadDropLocationImages,
    getLoadImages,
    testAuth,
    debugFileUpload,
    testPickupWithoutFiles,
    testLoadStatus,
    realTimeLoadCheck,
    checkLoadStatus,
    showAllImages,
    resetLoadStatus,
    getInhouseUserLoads,
    getInhouseUserLoadDetails,
    createLoadBySalesUser,
    getLoadsCreatedBySalesUser,
    getUserLoads,
    getInhouseUserCreatedLoads,
    debugInhouseLoads
} from '../controllers/loadController.js';
import { isAuthenticatedUser, isShipper, isAuthenticatedEmployee } from '../middlewares/auth.js';
import { updateTrackingLocation as updateTrackingLocationBid, updateTrackingStatus as updateTrackingStatusBid, getTrackingDetails as getTrackingDetailsBid, updateTrackingLocationByShipment as updateTrackingLocationByShipmentBid } from '../controllers/bidController.js';
import { 
    proofOfDeliveryUpload, 
    shipperTruckerUpload,
    driverPickupUpload,
    driverLoadedUpload,
    driverPODUpload,
    driverDropLocationUpload
} from '../middlewares/upload.js';

const loadRouter = express.Router();

// Load Board Routes (Public)
loadRouter.get('/available', getAvailableLoads); // Public route for load board
loadRouter.get('/search', searchLoads); // Public search route
loadRouter.get('/stats', getLoadStats); // Public stats route

// ✅ Unified API for any authenticated user to view their own loads
loadRouter.get('/my-loads', isAuthenticatedUser, getUserLoads);

// Test endpoints for debugging
loadRouter.get('/test-auth', isAuthenticatedUser, testUserAuth);
loadRouter.get('/test-model', testLoadModel); // Public test
loadRouter.get('/test-auth-new', isAuthenticatedUser, testAuth); // New test endpoint
loadRouter.post('/debug-upload', driverPickupUpload, debugFileUpload); // Debug file upload
loadRouter.post('/shipment/:shipmentNumber/test-pickup', testPickupWithoutFiles); // Test without files
loadRouter.get('/shipment/:shipmentNumber/status', testLoadStatus); // Test load status
loadRouter.get('/shipment/:shipmentNumber/realtime', realTimeLoadCheck); // Real-time database check
loadRouter.get('/shipment/:shipmentNumber/check-status', checkLoadStatus); // Check current status
loadRouter.get('/shipment/:shipmentNumber/all-images', showAllImages); // Show all uploaded images
loadRouter.put('/shipment/:shipmentNumber/reset-status', resetLoadStatus); // Reset status for testing

loadRouter.post('/create', isShipper, createLoad); 
loadRouter.get('/shipper', isShipper, getShipperLoads); 

// Sales user creates load for their shipper
loadRouter.post('/create-by-sales', isAuthenticatedEmployee, createLoadBySalesUser);

// Sales user gets loads they created
loadRouter.get('/sales-user-loads', isAuthenticatedEmployee, getLoadsCreatedBySalesUser);

// Inhouse user routes
loadRouter.get('/inhouse', isAuthenticatedEmployee, getInhouseUserLoads);
loadRouter.get('/inhouse/:loadId', isAuthenticatedEmployee, getInhouseUserLoadDetails);

// ✅ Simple API for inhouse users to see loads they created
loadRouter.get('/inhouse-created', isAuthenticatedEmployee, getInhouseUserCreatedLoads);

// ✅ Debug endpoint to check loads and understand the data
loadRouter.get('/inhouse-debug', isAuthenticatedEmployee, debugInhouseLoads);

// Update existing loads with geocoding (admin/dev use)
loadRouter.post('/update-geocoding', updateLoadsWithGeocoding);

// loadRouter.post('/create', createLoad); 
// loadRouter.get('/shipper',  getShipperLoads);
loadRouter.get('/trucker', isAuthenticatedUser, getTruckerLoads); 

// Get all shipments from Tracking table
loadRouter.get('/all-trackings', getAllTrackings);
loadRouter.get('/shipment/:shipmentNumber', getTrackingByShipmentNumber);

// Tracking location update route by shipment number (MUST BE BEFORE PARAMETERIZED ROUTES)
loadRouter.post('/shipment/:shipmentNumber/location', updateTrackingLocationByShipmentBid); // Removed authentication for testing

// Parameterized routes last
loadRouter.get('/:id', getLoadDetails); // Public route for load details

loadRouter.put('/:id/status', isAuthenticatedUser, updateLoadStatus); // Both can update status
loadRouter.delete('/:id', isShipper, cancelLoad); // Only shippers can cancel loads

// Tracking location update route
loadRouter.post('/:loadId/location', isAuthenticatedUser, updateTrackingLocationBid);

// Tracking status update route
loadRouter.post('/:loadId/status', isAuthenticatedUser, updateTrackingStatusBid);

// Trip (tracking) details route
loadRouter.get('/:loadId/trip', isAuthenticatedUser, getTrackingDetailsBid);

// Driver image upload routes (by shipment number) - Authentication optional
loadRouter.post('/shipment/:shipmentNumber/pickup-images', driverPickupUpload, uploadPickupImages);
loadRouter.post('/shipment/:shipmentNumber/loaded-images', driverLoadedUpload, uploadLoadedTruckImages);
loadRouter.post('/shipment/:shipmentNumber/pod-images', driverPODUpload, uploadPODImages);
loadRouter.post('/shipment/:shipmentNumber/drop-location-images', driverDropLocationUpload, uploadDropLocationImages);
loadRouter.get('/shipment/:shipmentNumber/images', getLoadImages);

// Driver uploads proof images (legacy)
loadRouter.post('/:id/proof', isAuthenticatedUser, proofOfDeliveryUpload.array('proof', 5), uploadProofOfDelivery);
// Shipper approves delivery
loadRouter.post('/:id/approve-delivery', isAuthenticatedUser, approveDelivery);

// TEMP: Create tracking record for a load (admin/dev use only)
loadRouter.post('/:id/create-tracking', isAuthenticatedUser, createTrackingForLoad);



export default loadRouter;