import express from 'express';
import {
  placeBid,
  updateBid,
  getBidsForLoad,
  updateBidStatus,
  getTruckerBids,
  withdrawBid,
  getBidStats,
  testUserLoads,
  approveBidIntermediate,
  approveBidIntermediateAuto,
  getAcceptedBidsForTrucker,
  assignDriverAndVehicle,
  approveBidByOps,
  placeBidByInhouseUser
} from '../controllers/bidController.js';
import { isAuthenticatedUser, isShipper, isTrucker } from '../middlewares/auth.js';
import { shipperTruckerUpload } from '../middlewares/upload.js';

const bidRouter = express.Router();

// Test endpoint for debugging
bidRouter.get('/test-user-loads', isShipper, testUserLoads);

// Statistics Route (Public)
bidRouter.get('/stats', getBidStats);

// Specific routes first (before parameterized routes)
bidRouter.post('/place', isTrucker, placeBid); // Only truckers can place bids
bidRouter.post('/place-by-inhouse', placeBidByInhouseUser); // Inhouse users can place bids on behalf of truckers
bidRouter.get('/load/:loadId', isShipper, getBidsForLoad); // Only shippers can view bids for their loads
bidRouter.get('/trucker', isTrucker, getTruckerBids); // Only truckers can view their bids

// Parameterized routes last
bidRouter.put('/:bidId', isTrucker, updateBid); // Only truckers can update their bids
bidRouter.put('/:bidId/status', isShipper, shipperTruckerUpload.single('doDocument'), updateBidStatus); // Only shippers can accept/reject bids
bidRouter.delete('/:bidId', isTrucker, withdrawBid); // Only truckers can withdraw their bids

// Add intermediate approval route (should be protected in production)
bidRouter.put('/intermediate/:bidId/approve', approveBidIntermediate);
// Add auto-approve with 5% markup route
bidRouter.put('/intermediate/:bidId/auto-approve', approveBidIntermediateAuto);

bidRouter.get('/accepted', isTrucker, getAcceptedBidsForTrucker); // Only truckers can view their accepted bids

bidRouter.post('/:bidId/assign-driver', isTrucker, assignDriverAndVehicle); // Trucker assigns driver/vehicle details

bidRouter.put('/:bidId/approve', approveBidByOps); // Employee approves bid (basic, no auth)

export default bidRouter;