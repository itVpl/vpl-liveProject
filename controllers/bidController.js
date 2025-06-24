import Bid from "../models/bidModel.js";
import { Load } from "../models/loadModel.js";

// ✅ Carrier places a bid
export const placeBid = async (req, res, next) => {
    try {
        const { loadId, rate, message, estimatedPickupDate, estimatedDeliveryDate } = req.body;

        // Check if load exists and is available for bidding
        const load = await Load.findById(loadId);
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }

        if (!['Posted', 'Bidding'].includes(load.status)) {
            return res.status(400).json({
                success: false,
                message: 'Load is not available for bidding'
            });
        }

        // Check if trucker has already bid on this load
        const existingBid = await Bid.findOne({
            load: loadId,
            carrier: req.user._id
        });

        if (existingBid) {
            return res.status(400).json({
                success: false,
                message: 'You have already placed a bid on this load'
            });
        }

        const bid = new Bid({
            load: loadId,
            carrier: req.user._id,
            rate,
            message,
            estimatedPickupDate,
            estimatedDeliveryDate,
        });

        await bid.save();

        // Update load status to 'Bidding' if it was 'Posted'
        if (load.status === 'Posted') {
            load.status = 'Bidding';
            await load.save();
        }

        res.status(201).json({
            success: true,
            message: 'Bid placed successfully',
            bid,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Update existing bid
export const updateBid = async (req, res, next) => {
    try {
        const { bidId } = req.params;
        const { rate, message, estimatedPickupDate, estimatedDeliveryDate } = req.body;

        const bid = await Bid.findById(bidId);
        if (!bid) {
            return res.status(404).json({
                success: false,
                message: 'Bid not found'
            });
        }

        if (bid.carrier.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this bid'
            });
        }

        if (bid.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update accepted or rejected bid'
            });
        }

        bid.rate = rate;
        bid.message = message;
        bid.estimatedPickupDate = estimatedPickupDate;
        bid.estimatedDeliveryDate = estimatedDeliveryDate;
        bid.updatedAt = Date.now();

        await bid.save();

        res.status(200).json({
            success: true,
            message: 'Bid updated successfully',
            bid,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Shipper views all bids for a load
export const getBidsForLoad = async (req, res, next) => {
    try {
        const { loadId } = req.params;
        
        console.log('🔍 Debug - Load ID:', loadId);
        console.log('🔍 Debug - User ID:', req.user?._id);
        console.log('🔍 Debug - User Type:', req.user?.userType);
        
        const load = await Load.findById(loadId);
        console.log('🔍 Debug - Load found:', !!load);
        
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }

        console.log('🔍 Debug - Load shipper ID:', load.shipper);
        console.log('🔍 Debug - Current user ID:', req.user._id);
        console.log('🔍 Debug - IDs match:', load.shipper.toString() === req.user._id.toString());

        // Check if user is the shipper of this load
        if (load.shipper.toString() !== req.user._id.toString()) {
            console.log('❌ Authorization failed - Load belongs to different shipper');
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view bids for this load. This load belongs to a different shipper.',
                debug: {
                    loadShipperId: load.shipper.toString(),
                    currentUserId: req.user._id.toString(),
                    userType: req.user.userType
                }
            });
        }

        const bids = await Bid.find({ load: loadId })
            .populate('carrier', 'compName mc_dot_no city state phoneNo email fleetsize')
            .sort({ rate: 1, createdAt: 1 });

        console.log('🔍 Debug - Found bids count:', bids.length);

        res.status(200).json({
            success: true,
            bids,
            totalBids: bids.length,
        });
    } catch (error) {
        console.error('❌ Error in getBidsForLoad:', error);
        next(error);
    }
};

// ✅ Shipper accepts/rejects a bid
export const updateBidStatus = async (req, res, next) => {
    try {
        const { bidId } = req.params;
        const { status, reason } = req.body; // 'Accepted' or 'Rejected'

        const bid = await Bid.findById(bidId).populate('load');
        if (!bid) {
            return res.status(404).json({ success: false, message: 'Bid not found' });
        }

        // Check if user is the shipper of this load
        if (bid.load.shipper.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this bid'
            });
        }

        if (status === 'Accepted') {
            // Update bid status
            bid.status = 'Accepted';
            bid.acceptedAt = Date.now();
            bid.rejectionReason = reason;
            await bid.save();

            // Assign load to this carrier
            const load = await Load.findById(bid.load._id);
            load.status = 'Assigned';
            load.assignedTo = bid.carrier;
            load.acceptedBid = bid._id;
            await load.save();

            // Reject all other bids for same load
            await Bid.updateMany(
                { load: bid.load._id, _id: { $ne: bid._id } },
                { 
                    status: 'Rejected',
                    rejectionReason: 'Another bid was accepted',
                    rejectedAt: Date.now()
                }
            );
        } else {
            bid.status = 'Rejected';
            bid.rejectionReason = reason;
            bid.rejectedAt = Date.now();
            await bid.save();
        }

        res.status(200).json({
            success: true,
            message: `Bid ${status.toLowerCase()} successfully`,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get trucker's bids
export const getTruckerBids = async (req, res, next) => {
    try {
        const bids = await Bid.find({ carrier: req.user._id })
            .populate('load', 'origin destination weight commodity vehicleType status pickupDate deliveryDate')
            .populate('load.shipper', 'compName mc_dot_no')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            bids,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Withdraw bid
export const withdrawBid = async (req, res, next) => {
    try {
        const { bidId } = req.params;

        const bid = await Bid.findById(bidId);
        if (!bid) {
            return res.status(404).json({
                success: false,
                message: 'Bid not found'
            });
        }

        if (bid.carrier.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to withdraw this bid'
            });
        }

        if (bid.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Cannot withdraw accepted or rejected bid'
            });
        }

        await Bid.findByIdAndDelete(bidId);

        // Check if this was the only bid on the load
        const remainingBids = await Bid.countDocuments({ load: bid.load });
        if (remainingBids === 0) {
            const load = await Load.findById(bid.load);
            if (load && load.status === 'Bidding') {
                load.status = 'Posted';
                await load.save();
            }
        }

        res.status(200).json({
            success: true,
            message: 'Bid withdrawn successfully',
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get bid statistics
export const getBidStats = async (req, res, next) => {
    try {
        const stats = await Bid.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgRate: { $avg: '$rate' }
                }
            }
        ]);

        const totalBids = await Bid.countDocuments();
        const pendingBids = await Bid.countDocuments({ status: 'Pending' });
        const acceptedBids = await Bid.countDocuments({ status: 'Accepted' });

        res.status(200).json({
            success: true,
            stats,
            totalBids,
            pendingBids,
            acceptedBids,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Test endpoint to check user's loads and authentication
export const testUserLoads = async (req, res, next) => {
    try {
        console.log('🔍 Debug - Testing user loads...');
        console.log('🔍 Debug - User ID:', req.user?._id);
        console.log('🔍 Debug - User Type:', req.user?.userType);
        console.log('🔍 Debug - User Status:', req.user?.status);
        
        if (!req.user) {
            return res.status(400).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        // Get user's loads
        const userLoads = await Load.find({ shipper: req.user._id })
            .select('_id origin destination commodity status createdAt')
            .sort({ createdAt: -1 });

        console.log('🔍 Debug - User loads count:', userLoads.length);

        res.status(200).json({
            success: true,
            message: 'User loads test completed',
            user: {
                id: req.user._id,
                userType: req.user.userType,
                status: req.user.status,
                compName: req.user.compName
            },
            loads: userLoads,
            totalLoads: userLoads.length
        });
    } catch (error) {
        console.error('❌ Error in testUserLoads:', error);
        next(error);
    }
};