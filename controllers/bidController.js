import Bid from "../models/bidModel.js";
import { Load } from "../models/loadModel.js";
import ShipperDriver from '../models/shipper_driverModel.js';
import { sendEmail } from '../utils/sendEmail.js';
import Tracking from '../models/Tracking.js';
import { getLatLngFromAddress } from '../utils/geocode.js';
import Driver from '../models/driverModel.js';

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
            status: 'PendingApproval',
            intermediateRate: null
        });

        await bid.save();

        // Update load status to 'Bidding' if it was 'Posted'
        if (load.status === 'Posted') {
            load.status = 'Bidding';
            await load.save();
        }

        res.status(201).json({
            success: true,
            message: 'Bid placed successfully and is pending approval',
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
        console.log('🔍 Debug - IDs match:', load.shipper && req.user._id ? load.shipper.toString() === req.user._id.toString() : false);

        // Check if user is the shipper of this load
        if (!load.shipper || !req.user._id || load.shipper.toString() !== req.user._id.toString()) {
            console.log('❌ Authorization failed - Load belongs to different shipper or shipper is null');
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view bids for this load. This load belongs to a different shipper or shipper is missing.',
                debug: {
                    loadShipperId: load.shipper ? load.shipper.toString() : null,
                    currentUserId: req.user._id ? req.user._id.toString() : null,
                    userType: req.user.userType
                }
            });
        }

        const bids = await Bid.find({ load: loadId, status: { $in: ['Pending', 'Accepted', 'Rejected'] } })
            .populate('carrier', 'compName mc_dot_no city state phoneNo email fleetsize')
            .sort({ rate: 1, createdAt: 1 });

        // Add driver and vehicle details to each bid in the response
        const formattedBids = bids.map(bid => ({
            ...bid.toObject(),
            driverName: bid.driverName,
            driverPhone: bid.driverPhone,
            vehicleNumber: bid.vehicleNumber,
            vehicleType: bid.vehicleType
        }));

        console.log('🔍 Debug - Found bids count:', bids.length);

        res.status(200).json({
            success: true,
            bids: formattedBids,
            totalBids: formattedBids.length,
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
        const { status, reason, shipmentNumber, origin, destination } = req.body; // 'Accepted' or 'Rejected', plus new fields

        const bid = await Bid.findById(bidId).populate('load');
        if (!bid) {
            return res.status(404).json({ success: false, message: 'Bid not found' });
        }

        // Check if user is the shipper of this load
        if (!bid.load.shipper || !req.user._id || bid.load.shipper.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this bid'
            });
        }

        if (status === 'Accepted') {
            // If shipper is trying to accept, set to PendingApproval instead
            bid.status = 'PendingApproval';
            bid.acceptedAt = null;
            bid.opsApproved = false;
            bid.opsApprovedAt = null;
            bid.rejectionReason = reason;
            // Save DO document if uploaded
            if (req.file) {
                const { normalizeShipperTruckerPath } = await import('../middlewares/upload.js');
                bid.doDocument = normalizeShipperTruckerPath(req.file.path);
            }
            await bid.save();

            // Assign load to this carrier
            const load = await Load.findById(bid.load._id);
            load.status = 'Assigned';
            load.assignedTo = bid.carrier;
            load.acceptedBid = bid._id;
            // Update shipment number and addresses if provided
            if (shipmentNumber) load.shipmentNumber = shipmentNumber;
            if (origin) {
                if (origin.addressLine1 !== undefined) load.origin.addressLine1 = origin.addressLine1;
                if (origin.addressLine2 !== undefined) load.origin.addressLine2 = origin.addressLine2;
            }
            if (destination) {
                if (destination.addressLine1 !== undefined) load.destination.addressLine1 = destination.addressLine1;
                if (destination.addressLine2 !== undefined) load.destination.addressLine2 = destination.addressLine2;
            }
            await load.save();

            // --- Tracking Logic Start ---
            // Check if tracking already exists for this load
            const existingTracking = await Tracking.findOne({ load: load._id });
            if (!existingTracking) {
                // Prepare full address strings
                const originAddress = `${load.origin.addressLine1 || ''} ${load.origin.addressLine2 || ''} ${load.origin.city}, ${load.origin.state}`.trim();
                const destinationAddress = `${load.destination.addressLine1 || ''} ${load.destination.addressLine2 || ''} ${load.destination.city}, ${load.destination.state}`.trim();
                // Geocode origin
                const originLatLng = await getLatLngFromAddress(originAddress);
                // Geocode destination
                const destinationLatLng = await getLatLngFromAddress(destinationAddress);
                if (originLatLng && destinationLatLng) {
                    await Tracking.create({
                        load: load._id,
                        originLatLng,
                        destinationLatLng,
                        status: 'in_transit',
                        startedAt: new Date(),
                        shipmentNumber: load.shipmentNumber || '',
                        vehicleNumber: bid.vehicleNumber || '',
                    });
                } else {
                    console.error('Geocoding failed for load', load._id);
                }
            }
            // --- Tracking Logic End ---

            // Reject all other bids for same load
            await Bid.updateMany(
                { load: bid.load._id, _id: { $ne: bid._id } },
                {
                    status: 'Rejected',
                    rejectionReason: 'Another bid was accepted',
                    rejectedAt: Date.now()
                }
            );

            // Send email notification to the trucker whose bid was accepted
            try {
                const trucker = await ShipperDriver.findById(bid.carrier);
                if (trucker && trucker.email) {
                    const subject = '🎉 Your Bid Has Been Accepted!';
                    const html = `
                        <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto;">
                          <h2 style="color: #2a7ae2; text-align: center;">🎉 Your Bid Has Been Accepted!</h2>
                          <p style="font-size: 16px; color: #333;">Congratulations! Your bid for the following load has been <b style='color: #27ae60;'>accepted</b> by the shipper.</p>
                          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="background: #eaf1fb;"><th colspan="2" style="padding: 8px; text-align: left; font-size: 16px;">Shipment Details</th></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">Shipment Number:</td><td style="padding: 8px;">${load.shipmentNumber || load._id}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">PO Number:</td><td style="padding: 8px;">${load.poNumber || ''}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">BOL Number:</td><td style="padding: 8px;">${load.bolNumber || ''}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">From:</td><td style="padding: 8px;">${load.origin.addressLine1 || ''} ${load.origin.addressLine2 || ''}, ${load.origin.city}, ${load.origin.state}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">To:</td><td style="padding: 8px;">${load.destination.addressLine1 || ''} ${load.destination.addressLine2 || ''}, ${load.destination.city}, ${load.destination.state}</td></tr>
                          </table>
                        </div>
                    `;
                    await sendEmail({
                        to: trucker.email,
                        subject,
                        html
                    });
                }
            } catch (err) {
                console.error('Error sending trucker notification:', err);
            }
        } else if (status === 'Rejected') {
            bid.status = 'Rejected';
            bid.rejectedAt = Date.now();
            bid.rejectionReason = reason;
            await bid.save();
        }

        // Always include these details in the response if bid is accepted
        let extraDetails = {};
        if (status === 'Accepted') {
            const load = await Load.findById(bid.load._id);
            if (bid.opsApproved) {
                extraDetails = {
                    shipmentNumber: load.shipmentNumber || '',
                    poNumber: load.poNumber || '',
                    bolNumber: load.bolNumber || '',
                    doDocument: bid.doDocument || '',
                };
            } else {
                extraDetails = { message: 'Pending internal approval.' };
            }
        }

        res.status(200).json({
            success: true,
            message: `Bid status updated to ${status}`,
            bid,
            ...extraDetails,
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

// ✅ Intermediate user approves/updates bid rate
export const approveBidIntermediate = async (req, res, next) => {
    try {
        const { bidId } = req.params;
        const { intermediateRate } = req.body;

        const bid = await Bid.findById(bidId);
        if (!bid) {
            return res.status(404).json({ success: false, message: 'Bid not found' });
        }

        if (bid.status !== 'PendingApproval') {
            return res.status(400).json({ success: false, message: 'Bid is not pending approval' });
        }

        // Update the intermediate rate and status
        bid.intermediateRate = intermediateRate;
        bid.status = 'Pending';
        await bid.save();

        res.status(200).json({
            success: true,
            message: 'Bid approved and rate updated. Now visible to shipper.',
            bid,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Intermediate user auto-approves bid with 5% markup
export const approveBidIntermediateAuto = async (req, res, next) => {
    try {
        const { bidId } = req.params;
        const bid = await Bid.findById(bidId);
        if (!bid) {
            return res.status(404).json({ success: false, message: 'Bid not found' });
        }
        if (bid.status !== 'PendingApproval') {
            return res.status(400).json({ success: false, message: 'Bid is not pending approval' });
        }
        // Calculate 5% markup
        const markupRate = Math.round(bid.rate * 1.05);
        bid.intermediateRate = markupRate;
        bid.status = 'Pending';
        await bid.save();
        res.status(200).json({
            success: true,
            message: 'Bid auto-approved with 5% markup. Now visible to shipper.',
            bid,
        });
    } catch (error) {
        next(error);
    }
};

// Get all accepted bids for the logged-in trucker
export const getAcceptedBidsForTrucker = async (req, res, next) => {
    try {
        const bids = await Bid.find({ carrier: req.user._id, status: 'Accepted' })
            .populate('load', 'shipmentNumber origin destination weight commodity vehicleType status pickupDate deliveryDate shipper compName poNumber bolNumber driverName driverPhone vehicleNumber vehicleType')
            .sort({ createdAt: -1 });

        // For each bid, fetch its tracking
        const formattedBids = await Promise.all(bids.map(async (bid) => {
            let tracking = await Tracking.findOne({ load: bid.load._id });
            return {
                bidId: bid._id,
                loadId: bid.load._id,
                shipmentNumber: bid.load?.shipmentNumber,
                origin: {
                    addressLine1: bid.load?.origin?.addressLine1,
                    addressLine2: bid.load?.origin?.addressLine2,
                    city: bid.load?.origin?.city,
                    state: bid.load?.origin?.state,
                    zip: bid.load?.origin?.zip
                },
                destination: {
                    addressLine1: bid.load?.destination?.addressLine1,
                    addressLine2: bid.load?.destination?.addressLine2,
                    city: bid.load?.destination?.city,
                    state: bid.load?.destination?.state,
                    zip: bid.load?.destination?.zip
                },
                commodity: bid.load?.commodity,
                vehicleType: bid.load?.vehicleType,
                weight: bid.load?.weight,
                pickupDate: bid.load?.pickupDate,
                deliveryDate: bid.load?.deliveryDate,
                status: bid.status,
                shipper: bid.load?.shipper,
                poNumber: bid.load?.poNumber,
                bolNumber: bid.load?.bolNumber,
                driverName: bid.load?.driverName,
                driverPhone: bid.load?.driverPhone,
                vehicleNumber: bid.load?.vehicleNumber,
                vehicleType: bid.load?.vehicleType,
                tracking: tracking ? {
                    driverName: tracking.driverName,
                    status: tracking.status,
                    currentLocation: tracking.currentLocation,
                    vehicleNumber: tracking.vehicleNumber,
                    shipmentNumber: tracking.shipmentNumber,
                    startedAt: tracking.startedAt,
                    endedAt: tracking.endedAt,
                    originLatLng: tracking.originLatLng,
                    destinationLatLng: tracking.destinationLatLng,
                    shipperName: tracking.shipperName,
                    truckerName: tracking.truckerName
                } : null
            };
        }));

        res.status(200).json({
            success: true,
            acceptedBids: formattedBids,
            total: formattedBids.length
        });
    } catch (error) {
        next(error);
    }
};

// Trucker assigns driver and vehicle details to an accepted bid
export const assignDriverAndVehicle = async (req, res, next) => {
    try {
        const { bidId } = req.params;
        const { driverId, vehicleNumber, vehicleType } = req.body;

        // Find the bid and check ownership and status
        const bid = await Bid.findById(bidId).populate({
            path: 'load',
            populate: { path: 'shipper', select: 'email compName' }
        });
        if (!bid) {
            return res.status(404).json({ success: false, message: 'Bid not found' });
        }
        if (bid.carrier.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this bid' });
        }
        if (bid.status !== 'Accepted') {
            return res.status(400).json({ success: false, message: 'Can only assign driver/vehicle to accepted bids' });
        }

        // Check driver exists and belongs to this trucker
        const driver = await Driver.findOne({ _id: driverId, truckerId: req.user._id });
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found or not your driver' });
        }

        // Save details from driver
        bid.driverName = driver.fullName;
        bid.driverPhone = driver.phone;
        bid.vehicleNumber = vehicleNumber;
        bid.vehicleType = vehicleType;
        await bid.save();

        // Update Tracking record with all required info
        const Tracking = (await import('../models/Tracking.js')).default;
        const ShipperDriver = (await import('../models/shipper_driverModel.js')).default;
        const Load = (await import('../models/loadModel.js')).Load;
        // Populate all required info
        const load = await Load.findById(bid.load._id).populate('shipper', 'compName');
        const trucker = await ShipperDriver.findById(bid.carrier);

        // Assign the driver and carrier to the load
        load.assignedTo = driver._id; // Driver ki ID
        load.carrier = req.user._id;  // Trucker/Carrier ki ID
        await load.save();

        let tracking = await Tracking.findOne({ load: load._id });
        if (!tracking) {
            // If not exists, create new
            tracking = new Tracking({
                load: load._id,
                originLatLng: { lat: load.origin.lat || 0, lon: load.origin.lon || 0 },
                destinationLatLng: { lat: load.destination.lat || 0, lon: load.destination.lon || 0 },
                status: 'in_transit',
                vehicleNumber: vehicleNumber,
                shipmentNumber: load.shipmentNumber || load._id,
            });
        }
        // Add/Update extra info as per requirement
        tracking.status = 'in_transit';
        tracking.vehicleNumber = vehicleNumber;
        tracking.shipmentNumber = load.shipmentNumber || load._id;
        tracking.originName = load.origin.city + ', ' + load.origin.state;
        tracking.destinationName = load.destination.city + ', ' + load.destination.state;
        tracking.loadId = load._id;
        tracking.shipperName = load.shipper.compName;
        tracking.truckerName = trucker.compName;
        tracking.bidId = bid._id;
        tracking.driverName = driver.fullName;
        await tracking.save();

        // Email shipper
        try {
            const shipper = bid.load.shipper;
            if (shipper && shipper.email) {
                const subject = '🚚 Driver & Vehicle Assigned';
                const html = `
                    <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto;">
                      <h2 style="color: #2a7ae2; text-align: center;">🚚 Driver & Vehicle Assigned</h2>
                      <p style="font-size: 16px; color: #333;">The following driver and vehicle have been assigned for your shipment:</p>
                      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background: #eaf1fb;"><th colspan="2" style="padding: 8px; text-align: left; font-size: 16px;">Driver & Vehicle Details</th></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Driver Name:</td><td style="padding: 8px;">${driver.fullName}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Driver Phone:</td><td style="padding: 8px;">${driver.phone}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Vehicle Number:</td><td style="padding: 8px;">${vehicleNumber}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Vehicle Type:</td><td style="padding: 8px;">${vehicleType}</td></tr>
                        <tr style="background: #eaf1fb;"><th colspan="2" style="padding: 8px; text-align: left; font-size: 16px;">Shipment Info</th></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Bid ID:</td><td style="padding: 8px;">${bid._id}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Shipment Number:</td><td style="padding: 8px;">${load.shipmentNumber || load._id}</td></tr>
                      </table>
                      <p style="font-size: 15px; color: #555;">Please login to your <a href='' style='color: #2a7ae2; text-decoration: underline;'>VPL account</a> for more details.</p>
                    </div>
                `;
                await sendEmail({
                    to: shipper.email,
                    subject,
                    html
                });
            }
        } catch (emailErr) {
            console.error('❌ Error sending driver/vehicle email to shipper:', emailErr);
        }

        // Email driver with shipment details
        try {
            if (driver && driver.email) {
                const subject = '🚚 Shipment Assignment Details';
                const html = `
                    <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto;">
                      <h2 style="color: #2a7ae2; text-align: center;">🚚 Shipment Assignment</h2>
                      <p style="font-size: 16px; color: #333;">You have been assigned to a new shipment. Please find the details below:</p>
                      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background: #eaf1fb;"><th colspan="2" style="padding: 8px; text-align: left; font-size: 16px;">Shipment Info</th></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Shipment Number:</td><td style="padding: 8px;">${load.shipmentNumber || load._id}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">From:</td><td style="padding: 8px;">${load.origin.city}, ${load.origin.state}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">To:</td><td style="padding: 8px;">${load.destination.city}, ${load.destination.state}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Pickup Date:</td><td style="padding: 8px;">${load.pickupDate ? new Date(load.pickupDate).toLocaleDateString() : ''}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Delivery Date:</td><td style="padding: 8px;">${load.deliveryDate ? new Date(load.deliveryDate).toLocaleDateString() : ''}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Shipper Name:</td><td style="padding: 8px;">${load.shipper.compName}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Trucker Name:</td><td style="padding: 8px;">${trucker.compName}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Bid ID:</td><td style="padding: 8px;">${bid._id}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Driver Name:</td><td style="padding: 8px;">${driver.fullName}</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Trip Status:</td><td style="padding: 8px;">in_transit</td></tr>
                      </table>
                      <p style="font-size: 15px; color: #555;">Please contact your dispatcher for more details or login to the VPL app.</p>
                    </div>
                `;
                await sendEmail({
                    to: driver.email,
                    subject,
                    html
                });
            }
        } catch (emailErr) {
            console.error('❌ Error sending shipment details email to driver:', emailErr);
        }

        res.status(200).json({
            success: true,
            message: 'Driver and vehicle details assigned, sent to shipper and driver, and trip updated.'
        });
    } catch (error) {
        next(error);
    }
};

// Update tracking location (for real-time updates from app)
export const updateTrackingLocation = async (req, res, next) => {
    try {
        const { loadId } = req.params;
        const { lat, lon } = req.body;
        if (!lat || !lon) {
            return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
        }
        const tracking = await Tracking.findOne({ load: loadId });
        if (!tracking) {
            return res.status(404).json({ success: false, message: 'Tracking record not found for this load.' });
        }
        tracking.currentLocation = { lat, lon, updatedAt: new Date() };
        await tracking.save();
        res.status(200).json({ success: true, message: 'Location updated successfully.', tracking });
    } catch (error) {
        next(error);
    }
};

// Update tracking location by shipment number (for real-time updates from app)
export const updateTrackingLocationByShipment = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        const { lat, lon } = req.body;
        if (!lat || !lon) {
            return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
        }
        const tracking = await Tracking.findOne({ shipmentNumber: shipmentNumber });
        if (!tracking) {
            return res.status(404).json({ success: false, message: 'Tracking record not found for this shipment number.' });
        }
        tracking.currentLocation = { lat, lon, updatedAt: new Date() };
        await tracking.save();
        res.status(200).json({ success: true, message: 'Location updated successfully.', tracking });
    } catch (error) {
        next(error);
    }
};

// Update tracking status (for in_transit, delivered, etc.)
export const updateTrackingStatus = async (req, res, next) => {
    try {
        const { loadId } = req.params;
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required.' });
        }
        const allowed = ['in_transit', 'delivered', 'pending'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status.' });
        }
        const tracking = await Tracking.findOne({ load: loadId });
        if (!tracking) {
            return res.status(404).json({ success: false, message: 'Tracking record not found for this load.' });
        }
        tracking.status = status;
        if (status === 'delivered') {
            tracking.endedAt = new Date();
        }
        await tracking.save();
        res.status(200).json({ success: true, message: 'Tracking status updated.', tracking });
    } catch (error) {
        next(error);
    }
};

async function createTrackingForLoad(load) {
    // Check if already exists
    const exists = await Tracking.findOne({ load: load._id });
    if (exists) return exists;

    // Get lat/lon from load.origin/destination (assume they exist)
    const originLatLng = { lat: load.origin.lat, lon: load.origin.lon };
    const destinationLatLng = { lat: load.destination.lat, lon: load.destination.lon };

    const tracking = new Tracking({
        load: load._id,
        originLatLng,
        destinationLatLng,
        status: 'in_transit',
        vehicleNumber: load.vehicleNumber || '',
        shipmentNumber: load.shipmentNumber || '',
    });
    await tracking.save();
    return tracking;
}

// Get trip (tracking) details for a load
export const getTrackingDetails = async (req, res, next) => {
    try {
        const { loadId } = req.params;
        const tracking = await Tracking.findOne({ load: loadId });
        if (!tracking) {
            return res.status(404).json({ success: false, message: 'Tracking record not found for this load.' });
        }
        res.status(200).json({ success: true, tracking });
    } catch (error) {
        next(error);
    }
};

// Approve bid by employee (ops)
export const approveBidByOps = async (req, res, next) => {
    try {
        const { bidId } = req.params;
        const bid = await Bid.findById(bidId).populate('load');
        if (!bid) {
            return res.status(404).json({ success: false, message: 'Bid not found' });
        }
        if (bid.opsApproved) {
            return res.status(400).json({ success: false, message: 'Bid already approved by ops.' });
        }
        bid.opsApproved = true;
        bid.opsApprovedAt = new Date();
        bid.status = 'Accepted';
        bid.acceptedAt = new Date();
        await bid.save();
        // Auto-create tracking record for the load if not exists
        const load = bid.load;
        if (load) {
            let tracking = await Tracking.findOne({ load: load._id });
            if (!tracking) {
                // Geocode origin and destination
                const originAddress = `${load.origin?.city || ''}, ${load.origin?.state || ''}`;
                const destinationAddress = `${load.destination?.city || ''}, ${load.destination?.state || ''}`;
                const originLatLng = await getLatLngFromAddress(originAddress) || { lat: 0, lon: 0 };
                const destinationLatLng = await getLatLngFromAddress(destinationAddress) || { lat: 0, lon: 0 };
                tracking = new Tracking({
                    load: load._id,
                    originLatLng,
                    destinationLatLng,
                    status: 'in_transit',
                    vehicleNumber: load.vehicleNumber || '',
                    shipmentNumber: load.shipmentNumber || '',
                });
                await tracking.save();
            }
        }
        res.status(200).json({ success: true, message: 'Bid approved by ops.', bid });
    } catch (error) {
        next(error);
    }
};

// ✅ Inhouse user places bid on behalf of trucker
export const placeBidByInhouseUser = async (req, res, next) => {
    try {
        const { loadId, truckerId, empId, rate, message, estimatedPickupDate, estimatedDeliveryDate } = req.body;

        console.log('Request body:', req.body);
        console.log('empId received:', empId);

        // Validate required fields
        if (!empId) {
            return res.status(400).json({
                success: false,
                message: 'empId is required'
            });
        }

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

        // Check if trucker exists
        const trucker = await ShipperDriver.findById(truckerId);
        if (!trucker) {
            return res.status(404).json({
                success: false,
                message: 'Trucker not found'
            });
        }

        // Check if trucker has already bid on this load
        const existingBid = await Bid.findOne({
            load: loadId,
            carrier: truckerId
        });

        if (existingBid) {
            return res.status(400).json({
                success: false,
                message: 'This trucker has already placed a bid on this load'
            });
        }

        const bid = new Bid({
            load: loadId,
            carrier: truckerId,
            rate,
            message,
            estimatedPickupDate,
            estimatedDeliveryDate,
            status: 'PendingApproval',
            intermediateRate: null,
            placedByInhouseUser: empId
        });

        console.log('Bid object before save:', bid);

        await bid.save();

        console.log('Bid saved with placedByInhouseUser:', bid.placedByInhouseUser);

        // Update load status to 'Bidding' if it was 'Posted'
        if (load.status === 'Posted') {
            load.status = 'Bidding';
            await load.save();
        }

        res.status(201).json({
            success: true,
            message: 'Bid placed successfully on behalf of trucker and is pending approval',
            bid,
        });
    } catch (error) {
        next(error);
    }
};