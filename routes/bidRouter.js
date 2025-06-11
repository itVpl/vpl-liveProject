import express from 'express';
import {
  placeBid,
  getBidsForLoad,
  updateBidStatus,
} from '../controllers/bidController.js';
import { isAuthenticatedUser } from '../middlewares/auth.js';

const bidRouter = express.Router();

// Carrier places bid
bidRouter.post('/place', isAuthenticatedUser, placeBid);

// Shipper gets all bids for a specific load
bidRouter.get('/load/:loadId', isAuthenticatedUser, getBidsForLoad);

// Shipper updates bid status
bidRouter.put('/:bidId/status', isAuthenticatedUser, updateBidStatus);

export default bidRouter;