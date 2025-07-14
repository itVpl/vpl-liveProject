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
    updateLoadsWithGeocoding
} from '../controllers/loadController.js';
import { isAuthenticatedUser, isShipper } from '../middlewares/auth.js';
import { updateTrackingLocation as updateTrackingLocationBid, updateTrackingStatus as updateTrackingStatusBid, getTrackingDetails as getTrackingDetailsBid } from '../controllers/bidController.js';
import { proofOfDeliveryUpload, shipperTruckerUpload } from '../middlewares/upload.js';

const loadRouter = express.Router();

// Load Board Routes (Public)
loadRouter.get('/available', getAvailableLoads); // Public route for load board
loadRouter.get('/search', searchLoads); // Public search route
loadRouter.get('/stats', getLoadStats); // Public stats route

// Test endpoints for debugging
loadRouter.get('/test-auth', isAuthenticatedUser, testUserAuth);
loadRouter.get('/test-model', testLoadModel); // Public test

loadRouter.post('/create', isShipper, createLoad); 
loadRouter.get('/shipper', isShipper, getShipperLoads); 

// Update existing loads with geocoding (admin/dev use)
loadRouter.post('/update-geocoding', updateLoadsWithGeocoding);

// loadRouter.post('/create', createLoad); 
// loadRouter.get('/shipper',  getShipperLoads);
loadRouter.get('/trucker', isAuthenticatedUser, getTruckerLoads); 

// Get all shipments from Tracking table
loadRouter.get('/all-trackings', getAllTrackings);
loadRouter.get('/shipment/:shipmentNumber', getTrackingByShipmentNumber);

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

// Driver uploads proof images
loadRouter.post('/:id/proof', isAuthenticatedUser, proofOfDeliveryUpload.array('proof', 5), uploadProofOfDelivery);
// Shipper approves delivery
loadRouter.post('/:id/approve-delivery', isAuthenticatedUser, approveDelivery);

// TEMP: Create tracking record for a load (admin/dev use only)
loadRouter.post('/:id/create-tracking', isAuthenticatedUser, createTrackingForLoad);



export default loadRouter;