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
  placeBidByInhouseUser,
  getBidsPendingIntermediateApproval,
  approveBidBySalesUser,
  getBidsWithIntermediateApprovalStatus,
  getIntermediateApprovalSummary,
  deleteLocationHistoryByShipment,
  deleteLocationHistoryByVehicle,
  deleteLocationHistoryByDateRange,
  getLocationHistoryStats,
  getPendingBidsBySalesUser,
  getIntermediateApprovalStatsByEmpId,
  getPendingBids,
  getPendingBidsByEmpId,
  acceptBidByInhouseUser
} from '../controllers/bidController.js';
import { isAuthenticatedUser, isShipper, isTrucker, isAuthenticatedEmployee } from '../middlewares/auth.js';
import { shipperTruckerUpload } from '../middlewares/upload.js';

const bidRouter = express.Router();

// Test endpoint for debugging
bidRouter.get('/test-user-loads', isShipper, testUserLoads);

// Statistics Route (Public)
bidRouter.get('/stats', getBidStats);

// ✅ NEW: Get all pending bids
bidRouter.get('/pending', getPendingBids);

// ✅ NEW: Get pending bids by approvedByinhouseUser empId
bidRouter.get('/pending/emp/:empId', getPendingBidsByEmpId);

// Get bids pending intermediate approval
bidRouter.get('/pending-intermediate-approval', getBidsPendingIntermediateApproval);

// Get pending bids by sales user empId
bidRouter.get('/pending-by-sales-user/:empId', getPendingBidsBySalesUser);

// Get intermediate approval statistics by empId
bidRouter.get('/intermediate-approval-stats/:empId', getIntermediateApprovalStatsByEmpId);

// Get intermediate rate approval summary
bidRouter.get('/intermediate-approval-summary', getIntermediateApprovalSummary);

// Get bids with intermediate approval status
bidRouter.get('/intermediate-approval-status', getBidsWithIntermediateApprovalStatus);

// 🔥 NEW: Location History Management APIs
bidRouter.delete('/location-history/shipment/:shipmentNumber', deleteLocationHistoryByShipment);
bidRouter.delete('/location-history/vehicle/:vehicleNumber', deleteLocationHistoryByVehicle);
bidRouter.delete('/location-history/date-range', deleteLocationHistoryByDateRange);
bidRouter.get('/location-history/stats', getLocationHistoryStats);

// Specific routes first (before parameterized routes)
bidRouter.post('/place', isTrucker, placeBid); // Only truckers can place bids
bidRouter.post('/place-by-inhouse', placeBidByInhouseUser); // Inhouse users can place bids on behalf of truckers
bidRouter.get('/load/:loadId', isShipper, getBidsForLoad); // Only shippers can view bids for their loads
bidRouter.get('/trucker', isTrucker, getTruckerBids); // Only truckers can view their bids

// Parameterized routes last
bidRouter.put('/:bidId', isTrucker, updateBid); // Only truckers can update their bids
bidRouter.put('/:bidId/status', isShipper, shipperTruckerUpload.single('doDocument'), updateBidStatus); // Only shippers can accept/reject bids
bidRouter.delete('/:bidId', isTrucker, withdrawBid); // Only truckers can withdraw their bids

// Add intermediate approval route (protected with employee authentication)
bidRouter.put('/intermediate/:bidId/approve', isAuthenticatedEmployee, approveBidIntermediate);
// Add auto-approve with 5% markup route (protected with employee authentication)
bidRouter.put('/intermediate/:bidId/auto-approve', isAuthenticatedEmployee, approveBidIntermediateAuto);
bidRouter.get('/accepted', isTrucker, getAcceptedBidsForTrucker); // Only truckers can view their accepted bids
bidRouter.post('/:bidId/assign-driver', isTrucker, assignDriverAndVehicle); // Trucker assigns driver/vehicle details as a reference of the inhouse user
bidRouter.put('/:bidId/approve', approveBidByOps); // Employee approves bid (basic, no auth) as a reference of the inhouse user
// 🔥 NEW: Enhanced bid approval by Sales users
bidRouter.put('/:bidId/approve-by-sales', approveBidBySalesUser); // Sales users can approve bids  for the reference of the inhouse user

// ✅ NEW: Inhouse user accepts bid on behalf of shipper
bidRouter.put('/:bidId/accept-by-inhouse', isAuthenticatedEmployee, acceptBidByInhouseUser); // Inhouse users can accept bids on behalf of shippers

export default bidRouter;