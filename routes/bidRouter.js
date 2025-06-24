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
} from '../controllers/bidController.js';
import { isAuthenticatedUser, isShipper, isTrucker } from '../middlewares/auth.js';

const bidRouter = express.Router();

// Test endpoint for debugging
bidRouter.get('/test-user-loads', isShipper, testUserLoads);

// Statistics Route (Public)
bidRouter.get('/stats', getBidStats);

// Specific routes first (before parameterized routes)
bidRouter.post('/place', isTrucker, placeBid); // Only truckers can place bids
bidRouter.get('/load/:loadId', isShipper, getBidsForLoad); // Only shippers can view bids for their loads
bidRouter.get('/trucker', isTrucker, getTruckerBids); // Only truckers can view their bids

// Parameterized routes last
bidRouter.put('/:bidId', isTrucker, updateBid); // Only truckers can update their bids
bidRouter.put('/:bidId/status', isShipper, updateBidStatus); // Only shippers can accept/reject bids
bidRouter.delete('/:bidId', isTrucker, withdrawBid); // Only truckers can withdraw their bids

export default bidRouter;