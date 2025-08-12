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
        const { intermediateRate, approvedBy } = req.body;

        const bid = await Bid.findById(bidId);
        if (!bid) {
            return res.status(404).json({ success: false, message: 'Bid not found' });
        }

        if (bid.status !== 'PendingApproval') {
            return res.status(400).json({ success: false, message: 'Bid is not pending approval' });
        }

        // Debug: Log user information
        console.log('🔍 Debug - req.user:', req.user);
        console.log('🔍 Debug - req.user.empId:', req.user?.empId);
        console.log('🔍 Debug - req.user.employeeName:', req.user?.employeeName);
        console.log('🔍 Debug - req.user.department:', req.user?.department);

        // Update the intermediate rate, status, and approval tracking
        bid.intermediateRate = intermediateRate;
        bid.status = 'Pending';
        // Save user details to the bid model
        bid.approvedByinhouseUser = {
            empId: req.user?.empId || 'Unknown',
            empName: req.user?.employeeName || req.user?.name || 'Unknown User',
            dept: req.user?.department || 'Unknown'
        };
        bid.intermediateApprovedAt = new Date();
        await bid.save();

                res.status(200).json({
                    success: true,
                    message: 'Bid approved and rate updated. Now visible to shipper.',
                    bid
                });
    } catch (error) {
        next(error);
    }
};

// ✅ Intermediate user auto-approves bid with 5% markup
export const approveBidIntermediateAuto = async (req, res, next) => {
    try {
        const { bidId } = req.params;
        const { approvedBy } = req.body;
        
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
        // Save user details to the bid model
        bid.approvedByinhouseUser = {
            empId: req.user?.empId || 'Unknown',
            empName: req.user?.employeeName || req.user?.name || 'Unknown User',
            dept: req.user?.department || 'Unknown'
        };
        bid.intermediateApprovedAt = new Date();
        await bid.save();

                res.status(200).json({
                    success: true,
                    message: 'Bid auto-approved with 5% markup. Now visible to shipper.',
                    bid
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
        const { 
            lat, 
            lon, 
            accuracy, 
            speed, 
            heading, 
            altitude,
            address,
            city,
            state,
            country,
            deviceInfo,
            tripProgress,
            notes 
        } = req.body;
        
        if (!lat || !lon) {
            return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
        }
        
        const tracking = await Tracking.findOne({ load: loadId });
        if (!tracking) {
            return res.status(404).json({ success: false, message: 'Tracking record not found for this load.' });
        }
        
        // Update current location in tracking
        tracking.currentLocation = { lat, lon, updatedAt: new Date() };
        await tracking.save();
        
        // 🔥 NEW: Store location history
        try {
            const { LocationHistory } = await import('../models/locationModel.js');
            
            const locationHistory = new LocationHistory({
                trackingId: tracking._id,
                vehicleNumber: tracking.vehicleNumber || '',
                shipmentNumber: tracking.shipmentNumber || '',
                latitude: lat,
                longitude: lon,
                locationData: {
                    accuracy: accuracy || null,
                    altitude: altitude || null,
                    speed: speed || null,
                    heading: heading || null,
                    address: address || null,
                    city: city || null,
                    state: state || null,
                    country: country || null
                },
                deviceInfo: deviceInfo || {},
                tripProgress: tripProgress || {},
                notes: notes || '',
                timestamp: new Date()
            });
            
            await locationHistory.save();
            console.log(`📍 Location history stored for tracking ${tracking._id}`);
            
        } catch (historyError) {
            console.error('❌ Error storing location history:', historyError);
            // Don't fail the main request if history storage fails
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Location updated successfully.', 
            tracking,
            deviceInfo: deviceInfo || {},
            tripProgress: tripProgress || {},
            locationHistoryStored: true
        });
    } catch (error) {
        next(error);
    }
};

// Update tracking location by shipment number (for real-time updates from app)
export const updateTrackingLocationByShipment = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        const { 
            lat, 
            lon, 
            accuracy, 
            speed, 
            heading, 
            altitude,
            address,
            city,
            state,
            country,
            deviceInfo,
            tripProgress,
            notes 
        } = req.body;
        
        if (!lat || !lon) {
            return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
        }
        
        const tracking = await Tracking.findOne({ shipmentNumber: shipmentNumber });
        if (!tracking) {
            return res.status(404).json({ success: false, message: 'Tracking record not found for this shipment number.' });
        }
        
        // Update current location in tracking
        tracking.currentLocation = { lat, lon, updatedAt: new Date() };
        await tracking.save();
        
        // 🔥 NEW: Store location history
        try {
            const { LocationHistory } = await import('../models/locationModel.js');
            
            const locationHistory = new LocationHistory({
                trackingId: tracking._id,
                vehicleNumber: tracking.vehicleNumber || '',
                shipmentNumber: tracking.shipmentNumber || '',
                latitude: lat,
                longitude: lon,
                locationData: {
                    accuracy: accuracy || null,
                    altitude: altitude || null,
                    speed: speed || null,
                    heading: heading || null,
                    address: address || null,
                    city: city || null,
                    state: state || null,
                    country: country || null
                },
                deviceInfo: deviceInfo || {},
                tripProgress: tripProgress || {},
                notes: notes || '',
                timestamp: new Date()
            });
            
            await locationHistory.save();
            console.log(`📍 Location history stored for shipment ${shipmentNumber}`);
            
        } catch (historyError) {
            console.error('❌ Error storing location history:', historyError);
            // Don't fail the main request if history storage fails
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Location updated successfully.', 
            tracking,
            deviceInfo: deviceInfo || {},
            tripProgress: tripProgress || {},
            locationHistoryStored: true
        });
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

// ✅ Get bids pending intermediate approval
export const getBidsPendingIntermediateApproval = async (req, res, next) => {
    try {
        const bids = await Bid.find({ status: 'PendingApproval' })
            .populate('load', 'origin destination commodity weight vehicleType pickupDate deliveryDate rate shipmentNumber createdBySalesUser customerAddedBy')
            .populate('carrier', 'compName mc_dot_no city state phoneNo email fleetsize')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: 'Bids pending intermediate approval retrieved successfully',
            count: bids.length,
            bids
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get intermediate rate approval summary
export const getIntermediateApprovalSummary = async (req, res, next) => {
    try {
        const { loadId, carrierId } = req.query;

        // Build filter object
        const filter = {};
        if (loadId) {
            filter.load = loadId;
        }
        if (carrierId) {
            filter.carrier = carrierId;
        }

        // Get summary statistics
        const summary = await Bid.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalBids: { $sum: 1 },
                    pendingApproval: { $sum: { $cond: [{ $eq: ['$status', 'PendingApproval'] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
                    accepted: { $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
                    withIntermediateRate: { $sum: { $cond: [{ $ne: ['$intermediateRate', null] }, 1, 0] } },
                    withoutIntermediateRate: { $sum: { $cond: [{ $eq: ['$intermediateRate', null] }, 1, 0] } },
                    avgOriginalRate: { $avg: '$rate' },
                    avgIntermediateRate: { $avg: '$intermediateRate' },
                    totalOriginalRate: { $sum: '$rate' },
                    totalIntermediateRate: { $sum: '$intermediateRate' }
                }
            }
        ]);

        // Get recent bids with approval status
        const recentBids = await Bid.find(filter)
            .populate('load', 'origin destination commodity weight vehicleType shipmentNumber')
            .populate('carrier', 'compName mc_dot_no city state')
            .sort({ createdAt: -1 })
            .limit(10)
            .select('rate intermediateRate status createdAt load carrier');

        const formattedRecentBids = recentBids.map(bid => ({
            _id: bid._id,
            load: bid.load,
            carrier: bid.carrier,
            originalRate: bid.rate,
            intermediateRate: bid.intermediateRate,
            status: bid.status,
            createdAt: bid.createdAt,
            approvalStatus: {
                hasIntermediateRate: bid.intermediateRate !== null,
                isPendingApproval: bid.status === 'PendingApproval',
                isPending: bid.status === 'Pending',
                isAccepted: bid.status === 'Accepted',
                isRejected: bid.status === 'Rejected',
                rateDifference: bid.intermediateRate ? bid.intermediateRate - bid.rate : null,
                rateDifferencePercentage: bid.intermediateRate ? ((bid.intermediateRate - bid.rate) / bid.rate * 100).toFixed(2) : null
            }
        }));

        const result = summary[0] || {
            totalBids: 0,
            pendingApproval: 0,
            pending: 0,
            accepted: 0,
            rejected: 0,
            withIntermediateRate: 0,
            withoutIntermediateRate: 0,
            avgOriginalRate: 0,
            avgIntermediateRate: 0,
            totalOriginalRate: 0,
            totalIntermediateRate: 0
        };

        // Calculate additional metrics
        const approvalRate = result.totalBids > 0 ? ((result.withIntermediateRate / result.totalBids) * 100).toFixed(2) : 0;
        const avgRateIncrease = result.avgOriginalRate > 0 && result.avgIntermediateRate > 0 ? 
            ((result.avgIntermediateRate - result.avgOriginalRate) / result.avgOriginalRate * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            message: 'Intermediate rate approval summary retrieved successfully',
            summary: {
                ...result,
                approvalRate: `${approvalRate}%`,
                avgRateIncrease: `${avgRateIncrease}%`,
                totalRateIncrease: result.totalIntermediateRate - result.totalOriginalRate
            },
            recentBids: formattedRecentBids,
            filters: {
                loadId: loadId || 'All loads',
                carrierId: carrierId || 'All carriers'
            }
        });
    } catch (error) {
        console.error('❌ Error in getIntermediateApprovalSummary:', error);
        next(error);
    }
};

// ✅ Get bids with intermediate rate approval status
export const getBidsWithIntermediateApprovalStatus = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            loadId,
            carrierId,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};

        // Apply filters
        if (status) {
            filter.status = status;
        }
        if (loadId) {
            filter.load = loadId;
        }
        if (carrierId) {
            filter.carrier = carrierId;
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Find bids with populated data
        const bids = await Bid.find(filter)
            .populate('load', 'origin destination commodity weight vehicleType pickupDate deliveryDate rate shipmentNumber status')
            .populate('carrier', 'compName mc_dot_no city state phoneNo email')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Bid.countDocuments(filter);

        // Get statistics
        const stats = await Bid.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalBids: { $sum: 1 },
                    pendingApproval: { $sum: { $cond: [{ $eq: ['$status', 'PendingApproval'] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
                    accepted: { $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
                    withIntermediateRate: { $sum: { $cond: [{ $ne: ['$intermediateRate', null] }, 1, 0] } },
                    withoutIntermediateRate: { $sum: { $cond: [{ $eq: ['$intermediateRate', null] }, 1, 0] } },
                    avgOriginalRate: { $avg: '$rate' },
                    avgIntermediateRate: { $avg: '$intermediateRate' }
                }
            }
        ]);

        // Format response with approval status
        const formattedBids = bids.map(bid => ({
            _id: bid._id,
            load: bid.load,
            carrier: bid.carrier,
            originalRate: bid.rate,
            intermediateRate: bid.intermediateRate,
            message: bid.message,
            estimatedPickupDate: bid.estimatedPickupDate,
            estimatedDeliveryDate: bid.estimatedDeliveryDate,
            status: bid.status,
            rejectionReason: bid.rejectionReason,
            acceptedAt: bid.acceptedAt,
            rejectedAt: bid.rejectedAt,
            createdAt: bid.createdAt,
            updatedAt: bid.updatedAt,
            driverName: bid.driverName,
            driverPhone: bid.driverPhone,
            vehicleNumber: bid.vehicleNumber,
            vehicleType: bid.vehicleType,
            doDocument: bid.doDocument,
            opsApproved: bid.opsApproved,
            opsApprovedAt: bid.opsApprovedAt,
            placedByInhouseUser: bid.placedByInhouseUser,
            // Approval status indicators
            approvalStatus: {
                hasIntermediateRate: bid.intermediateRate !== null,
                isPendingApproval: bid.status === 'PendingApproval',
                isPending: bid.status === 'Pending',
                isAccepted: bid.status === 'Accepted',
                isRejected: bid.status === 'Rejected',
                rateDifference: bid.intermediateRate ? bid.intermediateRate - bid.rate : null,
                rateDifferencePercentage: bid.intermediateRate ? ((bid.intermediateRate - bid.rate) / bid.rate * 100).toFixed(2) : null
            }
        }));

        res.status(200).json({
            success: true,
            message: 'Bids with intermediate approval status retrieved successfully',
            bids: formattedBids,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalBids: total,
            statistics: stats[0] || {
                totalBids: 0,
                pendingApproval: 0,
                pending: 0,
                accepted: 0,
                rejected: 0,
                withIntermediateRate: 0,
                withoutIntermediateRate: 0,
                avgOriginalRate: 0,
                avgIntermediateRate: 0
            }
        });
    } catch (error) {
        console.error('❌ Error in getBidsWithIntermediateApprovalStatus:', error);
        next(error);
    }
};

// 🔥 ENHANCED: Inhouse user places bid on behalf of trucker with better validation and notifications
export const placeBidByInhouseUser = async (req, res, next) => {
    try {
        const { 
            loadId, 
            truckerId, 
            empId, 
            rate, 
            message, 
            estimatedPickupDate, 
            estimatedDeliveryDate,
            driverName,
            driverPhone,
            vehicleNumber,
            vehicleType
        } = req.body;

        // 🔥 NEW: Enhanced validation
        if (!empId || !loadId || !truckerId || !rate) {
            return res.status(400).json({
                success: false,
                message: 'empId, loadId, truckerId, and rate are required'
            });
        }

        // Check if load exists and is available for bidding
        const load = await Load.findById(loadId).populate('shipper', 'compName email');
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

        // Check if trucker exists and is approved
        const trucker = await ShipperDriver.findById(truckerId);
        if (!trucker) {
            return res.status(404).json({
                success: false,
                message: 'Trucker not found'
            });
        }

        if (trucker.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Cannot place bid for unapproved trucker'
            });
        }

        if (trucker.userType !== 'trucker') {
            return res.status(400).json({
                success: false,
                message: 'Can only place bids for truckers'
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

        // 🔥 NEW: Enhanced bid creation with driver and vehicle info
        const bid = new Bid({
            load: loadId,
            carrier: truckerId,
            rate,
            message,
            estimatedPickupDate,
            estimatedDeliveryDate,
            status: 'PendingApproval',
            intermediateRate: null,
            placedByInhouseUser: empId,
            driverName: driverName || '',
            driverPhone: driverPhone || '',
            vehicleNumber: vehicleNumber || '',
            vehicleType: vehicleType || ''
        });

        await bid.save();

        // Update load status to 'Bidding' if it was 'Posted'
        if (load.status === 'Posted') {
            load.status = 'Bidding';
            await load.save();
        }

        // 🔥 NEW: Enhanced email notifications
        try {
            // Notify shipper about new bid
            if (load.shipper && load.shipper.email) {
                const shipperSubject = `New Bid Received - ${load.origin.city} to ${load.destination.city}`;
                const shipperHtml = `
                    <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                      <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                        <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">💰 New Bid Received</h1>
                        <div style="background: #27ae60; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                          <h2 style="margin: 0; font-size: 20px;">${trucker.compName}</h2>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                          <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Bid Details</h3>
                          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
                            <div>
                              <strong style="color: #34495e;">📍 Route:</strong><br>
                              <span style="color: #7f8c8d;">${load.origin.city} → ${load.destination.city}</span>
                            </div>
                            <div>
                              <strong style="color: #34495e;">💰 Bid Amount:</strong><br>
                              <span style="color: #7f8c8d;">$${rate}</span>
                            </div>
                            <div>
                              <strong style="color: #34495e;">🚛 Trucker:</strong><br>
                              <span style="color: #7f8c8d;">${trucker.compName}</span>
                            </div>
                            <div>
                              <strong style="color: #34495e;">👤 Placed By:</strong><br>
                              <span style="color: #7f8c8d;">CMT Team</span>
                            </div>
                            ${driverName ? `
                            <div>
                              <strong style="color: #34495e;">👨‍💼 Driver:</strong><br>
                              <span style="color: #7f8c8d;">${driverName}</span>
                            </div>
                            ` : ''}
                            ${vehicleNumber ? `
                            <div>
                              <strong style="color: #34495e;">🚚 Vehicle:</strong><br>
                              <span style="color: #7f8c8d;">${vehicleNumber}</span>
                            </div>
                            ` : ''}
                          </div>
                        </div>
                        
                        <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                          <p style="margin: 0; color: #27ae60; font-weight: bold;">💡 Ready to review this bid?</p>
                        </div>
                        
                        <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                          Login to your VPL account to review and accept/reject this bid!
                        </p>
                      </div>
                    </div>
                `;

                await sendEmail({
                    to: load.shipper.email,
                    subject: shipperSubject,
                    html: shipperHtml
                });
            }

            // Notify trucker about bid placement
            if (trucker.email) {
                const truckerSubject = `Bid Placed on Your Behalf - ${load.origin.city} to ${load.destination.city}`;
                const truckerHtml = `
                    <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                      <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                        <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">🎯 Bid Placed Successfully</h1>
                        <div style="background: #3498db; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                          <h2 style="margin: 0; font-size: 20px;">CMT Team Assistance</h2>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                          <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Bid Details</h3>
                          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
                            <div>
                              <strong style="color: #34495e;">📍 Route:</strong><br>
                              <span style="color: #7f8c8d;">${load.origin.city} → ${load.destination.city}</span>
                            </div>
                            <div>
                              <strong style="color: #34495e;">💰 Bid Amount:</strong><br>
                              <span style="color: #7f8c8d;">$${rate}</span>
                            </div>
                            <div>
                              <strong style="color: #34495e;">📅 Pickup Date:</strong><br>
                              <span style="color: #7f8c8d;">${estimatedPickupDate ? new Date(estimatedPickupDate).toLocaleDateString() : 'TBD'}</span>
                            </div>
                            <div>
                              <strong style="color: #34495e;">📅 Delivery Date:</strong><br>
                              <span style="color: #7f8c8d;">${estimatedDeliveryDate ? new Date(estimatedDeliveryDate).toLocaleDateString() : 'TBD'}</span>
                            </div>
                            ${driverName ? `
                            <div>
                              <strong style="color: #34495e;">👨‍💼 Driver:</strong><br>
                              <span style="color: #7f8c8d;">${driverName}</span>
                            </div>
                            ` : ''}
                            ${vehicleNumber ? `
                            <div>
                              <strong style="color: #34495e;">🚚 Vehicle:</strong><br>
                              <span style="color: #7f8c8d;">${vehicleNumber}</span>
                            </div>
                            ` : ''}
                          </div>
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                          <p style="margin: 0; color: #856404; font-weight: bold;">⏳ Status: Pending Approval</p>
                        </div>
                        
                        <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                          Our CMT team has placed this bid on your behalf. You'll be notified once the shipper reviews it.
                        </p>
                      </div>
                    </div>
                `;

                await sendEmail({
                    to: trucker.email,
                    subject: truckerSubject,
                    html: truckerHtml
                });
            }

            console.log(`📧 Bid notifications sent to shipper and trucker`);
        } catch (emailError) {
            console.error('❌ Error sending bid notifications:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'Bid placed successfully on behalf of trucker and is pending approval',
            bid,
        });
    } catch (error) {
        console.error('❌ Error in placeBidByInhouseUser:', error);
        next(error);
    }
};

// 🔥 NEW: Enhanced bid approval by Sales users with better notifications
export const approveBidBySalesUser = async (req, res, next) => {
    try {
        const { bidId } = req.params;
        const { status, reason, shipmentNumber, origin, destination } = req.body;

        // Validate user is Sales department
        if (!req.user || req.user.department !== 'Sales') {
            return res.status(403).json({
                success: false,
                message: 'Only Sales department users can approve bids'
            });
        }

        const bid = await Bid.findById(bidId)
            .populate('load')
            .populate('carrier', 'compName email phoneNo')
            .populate('load.shipper', 'compName email');

        if (!bid) {
            return res.status(404).json({ 
                success: false, 
                message: 'Bid not found' 
            });
        }

        // Check if bid is in correct status for approval
        if (bid.status !== 'PendingApproval') {
            return res.status(400).json({
                success: false,
                message: 'Bid is not in pending approval status'
            });
        }

        if (status === 'Accepted') {
            // Accept the bid
            bid.status = 'Accepted';
            bid.acceptedAt = new Date();
            bid.rejectionReason = '';
            await bid.save();

            // Update load status
            const load = await Load.findById(bid.load._id);
            load.status = 'Assigned';
            load.assignedTo = bid.carrier;
            load.acceptedBid = bid._id;
            
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

            // Reject all other bids for this load
            await Bid.updateMany(
                { load: bid.load._id, _id: { $ne: bid._id } },
                {
                    status: 'Rejected',
                    rejectionReason: 'Another bid was accepted',
                    rejectedAt: new Date()
                }
            );

            // 🔥 NEW: Enhanced notifications
            try {
                // Notify trucker about bid acceptance
                if (bid.carrier && bid.carrier.email) {
                    const truckerSubject = `🎉 Your Bid Has Been Accepted! - ${load.origin.city} to ${load.destination.city}`;
                    const truckerHtml = `
                        <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                          <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                            <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">🎉 Bid Accepted!</h1>
                            <div style="background: #27ae60; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                              <h2 style="margin: 0; font-size: 20px;">Congratulations!</h2>
                            </div>
                            
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                              <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Load Details</h3>
                              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
                                <div>
                                  <strong style="color: #34495e;">📍 Route:</strong><br>
                                  <span style="color: #7f8c8d;">${load.origin.city} → ${load.destination.city}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">💰 Accepted Rate:</strong><br>
                                  <span style="color: #7f8c8d;">$${bid.rate}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">📦 Commodity:</strong><br>
                                  <span style="color: #7f8c8d;">${load.commodity}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">⚖️ Weight:</strong><br>
                                  <span style="color: #7f8c8d;">${load.weight} kg</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">📅 Pickup Date:</strong><br>
                                  <span style="color: #7f8c8d;">${load.pickupDate ? new Date(load.pickupDate).toLocaleDateString() : 'TBD'}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">📅 Delivery Date:</strong><br>
                                  <span style="color: #7f8c8d;">${load.deliveryDate ? new Date(load.deliveryDate).toLocaleDateString() : 'TBD'}</span>
                                </div>
                                ${shipmentNumber ? `
                                <div>
                                  <strong style="color: #34495e;">📋 Shipment Number:</strong><br>
                                  <span style="color: #7f8c8d;">${shipmentNumber}</span>
                                </div>
                                ` : ''}
                              </div>
                            </div>
                            
                            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                              <p style="margin: 0; color: #27ae60; font-weight: bold;">✅ Status: Bid Accepted</p>
                            </div>
                            
                            <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                              Login to your VPL account to view the complete load details and start the delivery process!
                            </p>
                          </div>
                        </div>
                    `;

                    await sendEmail({
                        to: bid.carrier.email,
                        subject: truckerSubject,
                        html: truckerHtml
                    });
                }

                // Notify shipper about bid acceptance
                if (load.shipper && load.shipper.email) {
                    const shipperSubject = `Bid Accepted - ${load.origin.city} to ${load.destination.city}`;
                    const shipperHtml = `
                        <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                          <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                            <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">✅ Bid Accepted</h1>
                            <div style="background: #27ae60; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                              <h2 style="margin: 0; font-size: 20px;">Load Assigned Successfully</h2>
                            </div>
                            
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                              <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Assignment Details</h3>
                              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
                                <div>
                                  <strong style="color: #34495e;">📍 Route:</strong><br>
                                  <span style="color: #7f8c8d;">${load.origin.city} → ${load.destination.city}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">🚛 Assigned To:</strong><br>
                                  <span style="color: #7f8c8d;">${bid.carrier.compName}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">💰 Accepted Rate:</strong><br>
                                  <span style="color: #7f8c8d;">$${bid.rate}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">👤 Approved By:</strong><br>
                                  <span style="color: #7f8c8d;">${req.user.employeeName} (Sales)</span>
                                </div>
                                ${shipmentNumber ? `
                                <div>
                                  <strong style="color: #34495e;">📋 Shipment Number:</strong><br>
                                  <span style="color: #7f8c8d;">${shipmentNumber}</span>
                                </div>
                                ` : ''}
                              </div>
                            </div>
                            
                            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                              <p style="margin: 0; color: #27ae60; font-weight: bold;">✅ Status: Load Assigned</p>
                            </div>
                            
                            <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                              Your load has been successfully assigned. You can now create a DO (Delivery Order) for this shipment.
                            </p>
                          </div>
                        </div>
                    `;

                    await sendEmail({
                        to: load.shipper.email,
                        subject: shipperSubject,
                        html: shipperHtml
                    });
                }

                console.log(`📧 Bid acceptance notifications sent to trucker and shipper`);
            } catch (emailError) {
                console.error('❌ Error sending bid acceptance notifications:', emailError);
            }

            res.status(200).json({
                success: true,
                message: 'Bid accepted successfully',
                bid,
                load
            });

        } else if (status === 'Rejected') {
            // Reject the bid
            bid.status = 'Rejected';
            bid.rejectedAt = new Date();
            bid.rejectionReason = reason || 'Bid rejected by Sales team';
            await bid.save();

            // 🔥 NEW: Notify trucker about bid rejection
            try {
                if (bid.carrier && bid.carrier.email) {
                    const truckerSubject = `Bid Status Update - ${load.origin.city} to ${load.destination.city}`;
                    const truckerHtml = `
                        <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                          <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                            <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">📋 Bid Status Update</h1>
                            <div style="background: #e74c3c; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                              <h2 style="margin: 0; font-size: 20px;">Bid Not Accepted</h2>
                            </div>
                            
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                              <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Load Details</h3>
                              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
                                <div>
                                  <strong style="color: #34495e;">📍 Route:</strong><br>
                                  <span style="color: #7f8c8d;">${load.origin.city} → ${load.destination.city}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">💰 Your Bid:</strong><br>
                                  <span style="color: #7f8c8d;">$${bid.rate}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">📝 Reason:</strong><br>
                                  <span style="color: #7f8c8d;">${bid.rejectionReason}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                              <p style="margin: 0; color: #856404; font-weight: bold;">💡 Don't worry! Keep bidding on other loads</p>
                            </div>
                            
                            <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                              Thank you for your interest. Please continue to bid on other available loads!
                            </p>
                          </div>
                        </div>
                    `;

                    await sendEmail({
                        to: bid.carrier.email,
                        subject: truckerSubject,
                        html: truckerHtml
                    });
                }
                console.log(`📧 Bid rejection notification sent to trucker`);
            } catch (emailError) {
                console.error('❌ Error sending bid rejection notification:', emailError);
            }

            res.status(200).json({
                success: true,
                message: 'Bid rejected successfully',
                bid
            });

        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "Accepted" or "Rejected"'
            });
        }

    } catch (error) {
        console.error('❌ Error in approveBidBySalesUser:', error);
        next(error);
    }
};

// Get location history for a tracking
export const getLocationHistory = async (req, res, next) => {
    try {
        const { trackingId } = req.params;
        const { 
            startDate, 
            endDate, 
            limit = 1000, 
            skip = 0,
            sort = 'desc' // 'asc' or 'desc'
        } = req.query;
        
        const { LocationHistory } = await import('../models/locationModel.js');
        
        const options = {
            startDate,
            endDate,
            limit: parseInt(limit),
            skip: parseInt(skip),
            sort: { timestamp: sort === 'asc' ? 1 : -1 }
        };
        
        const locationHistory = await LocationHistory.getLocationHistory(trackingId, options);
        
        res.status(200).json({
            success: true,
            trackingId,
            locationHistory,
            totalPoints: locationHistory.length,
            filters: {
                startDate,
                endDate,
                limit: options.limit,
                skip: options.skip,
                sort
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get location history by shipment number
export const getLocationHistoryByShipment = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        const { 
            startDate, 
            endDate, 
            limit = 1000, 
            skip = 0,
            sort = 'desc'
        } = req.query;
        
        // First get tracking by shipment number
        const tracking = await Tracking.findOne({ shipmentNumber });
        if (!tracking) {
            return res.status(404).json({ 
                success: false, 
                message: 'Tracking record not found for this shipment number.' 
            });
        }
        
        const { LocationHistory } = await import('../models/locationModel.js');
        
        const options = {
            startDate,
            endDate,
            limit: parseInt(limit),
            skip: parseInt(skip),
            sort: { timestamp: sort === 'asc' ? 1 : -1 }
        };
        
        const locationHistory = await LocationHistory.getLocationHistory(tracking._id, options);
        
        res.status(200).json({
            success: true,
            shipmentNumber,
            trackingId: tracking._id,
            locationHistory,
            totalPoints: locationHistory.length,
            filters: {
                startDate,
                endDate,
                limit: options.limit,
                skip: options.skip,
                sort
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get location statistics for a tracking
export const getLocationStats = async (req, res, next) => {
    try {
        const { trackingId } = req.params;
        
        const { LocationHistory } = await import('../models/locationModel.js');
        
        const stats = await LocationHistory.getLocationStats(trackingId);
        
        res.status(200).json({
            success: true,
            trackingId,
            stats
        });
    } catch (error) {
        next(error);
    }
};

// Get location statistics by shipment number
export const getLocationStatsByShipment = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        
        // First get tracking by shipment number
        const tracking = await Tracking.findOne({ shipmentNumber });
        if (!tracking) {
            return res.status(404).json({ 
                success: false, 
                message: 'Tracking record not found for this shipment number.' 
            });
        }
        
        const { LocationHistory } = await import('../models/locationModel.js');
        
        const stats = await LocationHistory.getLocationStats(tracking._id);
        
        res.status(200).json({
            success: true,
            shipmentNumber,
            trackingId: tracking._id,
            stats
        });
    } catch (error) {
        next(error);
    }
};

// Get latest location for a tracking
export const getLatestLocation = async (req, res, next) => {
    try {
        const { trackingId } = req.params;
        
        const { LocationHistory } = await import('../models/locationModel.js');
        
        const latestLocation = await LocationHistory.getLatestLocation(trackingId);
        
        if (!latestLocation) {
            return res.status(404).json({
                success: false,
                message: 'No location history found for this tracking.'
            });
        }
        
        res.status(200).json({
            success: true,
            trackingId,
            latestLocation
        });
    } catch (error) {
        next(error);
    }
};

// Get latest location by shipment number
export const getLatestLocationByShipment = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        
        // First get tracking by shipment number
        const tracking = await Tracking.findOne({ shipmentNumber });
        if (!tracking) {
            return res.status(404).json({ 
                success: false, 
                message: 'Tracking record not found for this shipment number.' 
            });
        }
        
        const { LocationHistory } = await import('../models/locationModel.js');
        
        const latestLocation = await LocationHistory.getLatestLocation(tracking._id);
        
        if (!latestLocation) {
            return res.status(404).json({
                success: false,
                message: 'No location history found for this shipment.'
            });
        }
        
        res.status(200).json({
            success: true,
            shipmentNumber,
            trackingId: tracking._id,
            latestLocation
        });
    } catch (error) {
        next(error);
    }
};

// Bulk location update (for offline sync)
export const bulkLocationUpdate = async (req, res, next) => {
    try {
        const { trackingId } = req.params;
        const { locations } = req.body; // Array of location objects
        
        if (!locations || !Array.isArray(locations) || locations.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Locations array is required and must not be empty.'
            });
        }
        
        // Verify tracking exists
        const tracking = await Tracking.findById(trackingId);
        if (!tracking) {
            return res.status(404).json({
                success: false,
                message: 'Tracking record not found.'
            });
        }
        
        const { LocationHistory } = await import('../models/locationModel.js');
        
        const locationHistoryDocs = locations.map(location => ({
            trackingId: tracking._id,
            vehicleNumber: tracking.vehicleNumber || '',
            shipmentNumber: tracking.shipmentNumber || '',
            latitude: location.lat || location.latitude,
            longitude: location.lon || location.longitude,
            locationData: {
                accuracy: location.accuracy || null,
                altitude: location.altitude || null,
                speed: location.speed || null,
                heading: location.heading || null,
                address: location.address || null,
                city: location.city || null,
                state: location.state || null,
                country: location.country || null
            },
            deviceInfo: location.deviceInfo || {},
            tripProgress: location.tripProgress || {},
            notes: location.notes || '',
            timestamp: location.timestamp ? new Date(location.timestamp) : new Date()
        }));
        
        const savedLocations = await LocationHistory.insertMany(locationHistoryDocs);
        
        // Update current location to the latest one
        const latestLocation = locations[locations.length - 1];
        tracking.currentLocation = { 
            lat: latestLocation.lat || latestLocation.latitude, 
            lon: latestLocation.lon || latestLocation.longitude, 
            updatedAt: new Date() 
        };
        await tracking.save();
        
        res.status(200).json({
            success: true,
            message: 'Bulk location update completed successfully.',
            trackingId,
            locationsStored: savedLocations.length,
            latestLocation: tracking.currentLocation
        });
    } catch (error) {
        next(error);
    }
};

// 🔥 NEW: Delete Location History by Shipment Number
export const deleteLocationHistoryByShipment = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        const { 
            startDate, 
            endDate,
            confirmDelete = false 
        } = req.query;

        if (!shipmentNumber) {
            return res.status(400).json({
                success: false,
                message: 'Shipment number is required'
            });
        }

        const { LocationHistory } = await import('../models/locationModel.js');

        // ✅ 1. Build query based on shipment number and optional date range
        const query = { shipmentNumber };

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) {
                query.timestamp.$gte = new Date(startDate);
            }
            if (endDate) {
                query.timestamp.$lte = new Date(endDate);
            }
        }

        // ✅ 2. Get count of records to be deleted
        const recordsToDelete = await LocationHistory.countDocuments(query);

        if (recordsToDelete === 0) {
            return res.status(404).json({
                success: false,
                message: 'No location history records found for this shipment number',
                shipmentNumber,
                filters: { startDate, endDate }
            });
        }

        // ✅ 3. If confirmDelete is false, return preview of what will be deleted
        if (confirmDelete !== 'true') {
            const sampleRecords = await LocationHistory.find(query)
                .sort({ timestamp: -1 })
                .limit(5)
                .select('timestamp latitude longitude locationData.city locationData.state');

            return res.status(200).json({
                success: true,
                message: 'Preview of records to be deleted. Set confirmDelete=true to proceed.',
                shipmentNumber,
                recordsToDelete,
                sampleRecords,
                filters: { startDate, endDate },
                action: 'Add ?confirmDelete=true to the URL to proceed with deletion'
            });
        }

        // ✅ 4. Delete the records
        const deleteResult = await LocationHistory.deleteMany(query);

        // ✅ 5. Get statistics after deletion
        const remainingRecords = await LocationHistory.countDocuments({ shipmentNumber });

        console.log(`🗑️ Deleted ${deleteResult.deletedCount} location history records for shipment ${shipmentNumber}`);

        res.status(200).json({
            success: true,
            message: `Successfully deleted ${deleteResult.deletedCount} location history records`,
            shipmentNumber,
            deletedCount: deleteResult.deletedCount,
            remainingRecords,
            filters: { startDate, endDate },
            deletionTime: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error deleting location history:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// 🔥 NEW: Delete Location History by Vehicle Number
export const deleteLocationHistoryByVehicle = async (req, res, next) => {
    try {
        const { vehicleNumber } = req.params;
        const { 
            startDate, 
            endDate,
            confirmDelete = false 
        } = req.query;

        if (!vehicleNumber) {
            return res.status(400).json({
                success: false,
                message: 'Vehicle number is required'
            });
        }

        const { LocationHistory } = await import('../models/locationModel.js');

        // ✅ 1. Build query based on vehicle number and optional date range
        const query = { vehicleNumber };

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) {
                query.timestamp.$gte = new Date(startDate);
            }
            if (endDate) {
                query.timestamp.$lte = new Date(endDate);
            }
        }

        // ✅ 2. Get count of records to be deleted
        const recordsToDelete = await LocationHistory.countDocuments(query);

        if (recordsToDelete === 0) {
            return res.status(404).json({
                success: false,
                message: 'No location history records found for this vehicle number',
                vehicleNumber,
                filters: { startDate, endDate }
            });
        }

        // ✅ 3. If confirmDelete is false, return preview of what will be deleted
        if (confirmDelete !== 'true') {
            const sampleRecords = await LocationHistory.find(query)
                .sort({ timestamp: -1 })
                .limit(5)
                .select('timestamp latitude longitude shipmentNumber locationData.city locationData.state');

            return res.status(200).json({
                success: true,
                message: 'Preview of records to be deleted. Set confirmDelete=true to proceed.',
                vehicleNumber,
                recordsToDelete,
                sampleRecords,
                filters: { startDate, endDate },
                action: 'Add ?confirmDelete=true to the URL to proceed with deletion'
            });
        }

        // ✅ 4. Delete the records
        const deleteResult = await LocationHistory.deleteMany(query);

        // ✅ 5. Get statistics after deletion
        const remainingRecords = await LocationHistory.countDocuments({ vehicleNumber });

        console.log(`🗑️ Deleted ${deleteResult.deletedCount} location history records for vehicle ${vehicleNumber}`);

        res.status(200).json({
            success: true,
            message: `Successfully deleted ${deleteResult.deletedCount} location history records`,
            vehicleNumber,
            deletedCount: deleteResult.deletedCount,
            remainingRecords,
            filters: { startDate, endDate },
            deletionTime: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error deleting location history:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// 🔥 NEW: Delete Location History by Date Range
export const deleteLocationHistoryByDateRange = async (req, res, next) => {
    try {
        const { startDate, endDate, confirmDelete = false } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Both startDate and endDate are required'
            });
        }

        const { LocationHistory } = await import('../models/locationModel.js');

        // ✅ 1. Build query for date range
        const query = {
            timestamp: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        };

        // ✅ 2. Get count of records to be deleted
        const recordsToDelete = await LocationHistory.countDocuments(query);

        if (recordsToDelete === 0) {
            return res.status(404).json({
                success: false,
                message: 'No location history records found for the specified date range',
                filters: { startDate, endDate }
            });
        }

        // ✅ 3. If confirmDelete is false, return preview of what will be deleted
        if (confirmDelete !== 'true') {
            const sampleRecords = await LocationHistory.find(query)
                .sort({ timestamp: -1 })
                .limit(5)
                .select('timestamp latitude longitude vehicleNumber shipmentNumber locationData.city locationData.state');

            return res.status(200).json({
                success: true,
                message: 'Preview of records to be deleted. Set confirmDelete=true to proceed.',
                recordsToDelete,
                sampleRecords,
                filters: { startDate, endDate },
                action: 'Add ?confirmDelete=true to the URL to proceed with deletion'
            });
        }

        // ✅ 4. Delete the records
        const deleteResult = await LocationHistory.deleteMany(query);

        // ✅ 5. Get total remaining records
        const totalRemainingRecords = await LocationHistory.countDocuments({});

        console.log(`🗑️ Deleted ${deleteResult.deletedCount} location history records for date range ${startDate} to ${endDate}`);

        res.status(200).json({
            success: true,
            message: `Successfully deleted ${deleteResult.deletedCount} location history records`,
            deletedCount: deleteResult.deletedCount,
            totalRemainingRecords,
            filters: { startDate, endDate },
            deletionTime: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error deleting location history:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// 🔥 NEW: Get Location History Statistics
export const getLocationHistoryStats = async (req, res, next) => {
    try {
        const { LocationHistory } = await import('../models/locationModel.js');

        // ✅ 1. Get total records
        const totalRecords = await LocationHistory.countDocuments({});

        // ✅ 2. Get records by date ranges
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const last24Hours = await LocationHistory.countDocuments({
            timestamp: { $gte: oneDayAgo }
        });

        const lastWeek = await LocationHistory.countDocuments({
            timestamp: { $gte: oneWeekAgo }
        });

        const lastMonth = await LocationHistory.countDocuments({
            timestamp: { $gte: oneMonthAgo }
        });

        // ✅ 3. Get unique shipment numbers
        const uniqueShipments = await LocationHistory.distinct('shipmentNumber');

        // ✅ 4. Get unique vehicle numbers
        const uniqueVehicles = await LocationHistory.distinct('vehicleNumber');

        // ✅ 5. Get oldest and newest records
        const oldestRecord = await LocationHistory.findOne().sort({ timestamp: 1 }).select('timestamp');
        const newestRecord = await LocationHistory.findOne().sort({ timestamp: -1 }).select('timestamp');

        res.status(200).json({
            success: true,
            statistics: {
                totalRecords,
                last24Hours,
                lastWeek,
                lastMonth,
                uniqueShipments: uniqueShipments.length,
                uniqueVehicles: uniqueVehicles.length,
                oldestRecord: oldestRecord?.timestamp,
                newestRecord: newestRecord?.timestamp
            },
            sampleShipments: uniqueShipments.slice(0, 10),
            sampleVehicles: uniqueVehicles.slice(0, 10)
        });

    } catch (error) {
        console.error('❌ Error getting location history stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// ✅ Get pending bids by sales user empId
export const getPendingBidsBySalesUser = async (req, res, next) => {
    try {
        const { empId } = req.params;

        if (!empId) {
            return res.status(400).json({
                success: false,
                message: 'Sales user empId is required'
            });
        }

        // Find bids with status 'PendingApproval' and populate load details
        // Then filter by the sales user's empId in the load's createdBySalesUser field
        const bids = await Bid.find({ status: 'PendingApproval' })
            .populate({
                path: 'load',
                select: 'origin destination commodity weight vehicleType pickupDate deliveryDate rate shipmentNumber createdBySalesUser customerAddedBy',
                match: { 'createdBySalesUser.empId': empId }
            })
            .populate('carrier', 'compName mc_dot_no city state phoneNo email fleetsize')
            .sort({ createdAt: -1 });

        // Filter out bids where the load doesn't match the empId (due to populate match)
        const filteredBids = bids.filter(bid => bid.load !== null);

        res.status(200).json({
            success: true,
            message: `Pending bids for sales user ${empId} retrieved successfully`,
            count: filteredBids.length,
            salesUserEmpId: empId,
            bids: filteredBids
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get intermediate approval statistics by empId
export const getIntermediateApprovalStatsByEmpId = async (req, res, next) => {
    try {
        const { empId } = req.params;

        if (!empId) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        // Get all bids that were approved by this empId
        const approvedBids = await Bid.find({
            'intermediateApprovedBy.empId': empId,
            intermediateRate: { $ne: null }
        })
        .populate('load', 'origin destination commodity weight vehicleType pickupDate deliveryDate rate shipmentNumber createdBySalesUser customerAddedBy')
        .populate('carrier', 'compName mc_dot_no city state phoneNo email fleetsize')
        .sort({ intermediateApprovedAt: -1 });

        // Calculate statistics
        const totalApproved = approvedBids.length;
        const totalOriginalRate = approvedBids.reduce((sum, bid) => sum + bid.rate, 0);
        const totalIntermediateRate = approvedBids.reduce((sum, bid) => sum + (bid.intermediateRate || 0), 0);
        const avgOriginalRate = totalApproved > 0 ? totalOriginalRate / totalApproved : 0;
        const avgIntermediateRate = totalApproved > 0 ? totalIntermediateRate / totalApproved : 0;
        const totalRateIncrease = totalIntermediateRate - totalOriginalRate;
        const avgRateIncrease = totalApproved > 0 ? totalRateIncrease / totalApproved : 0;
        const avgRateIncreasePercentage = avgOriginalRate > 0 ? (avgRateIncrease / avgOriginalRate * 100) : 0;

        // Get approval statistics by date ranges
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const last24Hours = approvedBids.filter(bid => 
            bid.intermediateApprovedAt && bid.intermediateApprovedAt >= oneDayAgo
        ).length;

        const lastWeek = approvedBids.filter(bid => 
            bid.intermediateApprovedAt && bid.intermediateApprovedAt >= oneWeekAgo
        ).length;

        const lastMonth = approvedBids.filter(bid => 
            bid.intermediateApprovedAt && bid.intermediateApprovedAt >= oneMonthAgo
        ).length;

        // Get user details from the first approved bid (if any)
        const userDetails = approvedBids.length > 0 ? approvedBids[0].intermediateApprovedBy : null;

        res.status(200).json({
            success: true,
            message: `Intermediate approval statistics for ${empId} retrieved successfully`,
            userDetails,
            statistics: {
                totalApproved,
                last24Hours,
                lastWeek,
                lastMonth,
                totalOriginalRate: Math.round(totalOriginalRate),
                totalIntermediateRate: Math.round(totalIntermediateRate),
                avgOriginalRate: Math.round(avgOriginalRate),
                avgIntermediateRate: Math.round(avgIntermediateRate),
                totalRateIncrease: Math.round(totalRateIncrease),
                avgRateIncrease: Math.round(avgRateIncrease),
                avgRateIncreasePercentage: Math.round(avgRateIncreasePercentage * 100) / 100
            },
            recentApprovals: approvedBids.slice(0, 10).map(bid => ({
                bidId: bid._id,
                load: bid.load,
                carrier: bid.carrier,
                originalRate: bid.rate,
                intermediateRate: bid.intermediateRate,
                rateIncrease: bid.intermediateRate - bid.rate,
                rateIncreasePercentage: ((bid.intermediateRate - bid.rate) / bid.rate * 100).toFixed(2),
                approvedAt: bid.intermediateApprovedAt,
                status: bid.status
            }))
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get all pending bids
export const getPendingBids = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Find all bids with status "Pending"
        const bids = await Bid.find({ status: 'Pending' })
            .populate('load', 'origin destination commodity weight vehicleType pickupDate deliveryDate rate shipmentNumber status')
            .populate('carrier', 'compName mc_dot_no city state phoneNo email')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Bid.countDocuments({ status: 'Pending' });

        // Format response
        const formattedBids = bids.map(bid => ({
            _id: bid._id,
            load: bid.load,
            carrier: bid.carrier,
            originalRate: bid.rate,
            intermediateRate: bid.intermediateRate,
            message: bid.message,
            estimatedPickupDate: bid.estimatedPickupDate,
            estimatedDeliveryDate: bid.estimatedDeliveryDate,
            status: bid.status,
            createdAt: bid.createdAt,
            updatedAt: bid.updatedAt,
            driverName: bid.driverName,
            driverPhone: bid.driverPhone,
            vehicleNumber: bid.vehicleNumber,
            vehicleType: bid.vehicleType,
            doDocument: bid.doDocument,
            opsApproved: bid.opsApproved,
            opsApprovedAt: bid.opsApprovedAt,
            placedByInhouseUser: bid.placedByInhouseUser,
            approvedByinhouseUser: bid.approvedByinhouseUser,
            intermediateApprovedAt: bid.intermediateApprovedAt,
            // Approval status indicators
            approvalStatus: {
                hasIntermediateRate: bid.intermediateRate !== null,
                rateDifference: bid.intermediateRate ? bid.intermediateRate - bid.rate : null,
                rateDifferencePercentage: bid.intermediateRate ? ((bid.intermediateRate - bid.rate) / bid.rate * 100).toFixed(2) : null
            }
        }));

        res.status(200).json({
            success: true,
            message: 'Pending bids retrieved successfully',
            bids: formattedBids,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalBids: total,
            filters: {
                status: 'Pending',
                sortBy,
                sortOrder
            }
        });
    } catch (error) {
        console.error('❌ Error in getPendingBids:', error);
        next(error);
    }
};

// ✅ Get pending bids by approvedByinhouseUser empId
export const getPendingBidsByEmpId = async (req, res, next) => {
    try {
        const { empId } = req.params;
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        if (!empId) {
            return res.status(400).json({
                success: false,
                message: 'empId is required'
            });
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Find pending bids filtered by approvedByinhouseUser.empId
        const bids = await Bid.find({ 
            status: 'Pending',
            'approvedByinhouseUser.empId': empId
        })
            .populate('load', 'origin destination commodity weight vehicleType pickupDate deliveryDate rate shipmentNumber status')
            .populate('carrier', 'compName mc_dot_no city state phoneNo email')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Bid.countDocuments({ 
            status: 'Pending',
            'approvedByinhouseUser.empId': empId
        });

        // Format response
        const formattedBids = bids.map(bid => ({
            _id: bid._id,
            load: bid.load,
            carrier: bid.carrier,
            originalRate: bid.rate,
            intermediateRate: bid.intermediateRate,
            message: bid.message,
            estimatedPickupDate: bid.estimatedPickupDate,
            estimatedDeliveryDate: bid.estimatedDeliveryDate,
            status: bid.status,
            createdAt: bid.createdAt,
            updatedAt: bid.updatedAt,
            driverName: bid.driverName,
            driverPhone: bid.driverPhone,
            vehicleNumber: bid.vehicleNumber,
            vehicleType: bid.vehicleType,
            doDocument: bid.doDocument,
            opsApproved: bid.opsApproved,
            opsApprovedAt: bid.opsApprovedAt,
            placedByInhouseUser: bid.placedByInhouseUser,
            approvedByinhouseUser: bid.approvedByinhouseUser,
            intermediateApprovedAt: bid.intermediateApprovedAt,
            // Approval status indicators
            approvalStatus: {
                hasIntermediateRate: bid.intermediateRate !== null,
                rateDifference: bid.intermediateRate ? bid.intermediateRate - bid.rate : null,
                rateDifferencePercentage: bid.intermediateRate ? ((bid.intermediateRate - bid.rate) / bid.rate * 100).toFixed(2) : null
            }
        }));

        res.status(200).json({
            success: true,
            message: `Pending bids for empId ${empId} retrieved successfully`,
            empId,
            bids: formattedBids,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalBids: total,
            filters: {
                status: 'Pending',
                empId,
                sortBy,
                sortOrder
            }
        });
    } catch (error) {
        console.error('❌ Error in getPendingBidsByEmpId:', error);
        next(error);
    }
};

// ✅ NEW: Inhouse user accepts bid on behalf of shipper
export const acceptBidByInhouseUser = async (req, res, next) => {
    try {
        const { bidId } = req.params;
        const { 
            status, 
            reason, 
            shipmentNumber, 
            poNumber,
            bolNumber,
            origin, 
            destination,
            shipperId // ID of the shipper on whose behalf the bid is being accepted
        } = req.body;

        // Validate required fields
        if (!status || !shipperId) {
            return res.status(400).json({
                success: false,
                message: 'status and shipperId are required'
            });
        }

        if (!['Accepted', 'Rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "Accepted" or "Rejected"'
            });
        }

        // Find the bid and populate load with shipper details
        const bid = await Bid.findById(bidId).populate({
            path: 'load',
            populate: { path: 'shipper', select: 'email compName' }
        });

        if (!bid) {
            return res.status(404).json({ 
                success: false, 
                message: 'Bid not found' 
            });
        }

        // Check if bid is in valid status for acceptance
        if (bid.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Bid is not in pending status for acceptance'
            });
        }

        // Verify that the shipperId matches the load's shipper
        if (bid.load.shipper && bid.load.shipper._id.toString() !== shipperId) {
            return res.status(403).json({
                success: false,
                message: 'Shipper ID does not match the load owner'
            });
        }

        // Check if inhouse user has permission (Sales department or higher role)
        if (req.user.department !== 'Sales' && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Only Sales department users or admins can accept bids on behalf of shippers'
            });
        }

        if (status === 'Accepted') {
            // Accept the bid
            bid.status = 'Accepted';
            bid.acceptedAt = new Date();
            bid.rejectionReason = '';
            bid.acceptedByInhouseUser = {
                empId: req.user.empId,
                empName: req.user.employeeName,
                dept: req.user.department
            };
            await bid.save();

            // Update load status
            const load = await Load.findById(bid.load._id);
            load.status = 'Assigned';
            load.assignedTo = bid.carrier;
            load.acceptedBid = bid._id;
            
            if (shipmentNumber) load.shipmentNumber = shipmentNumber;
            if (poNumber) load.poNumber = poNumber;
            if (bolNumber) load.bolNumber = bolNumber;
            if (origin) {
                if (origin.addressLine1 !== undefined) load.origin.addressLine1 = origin.addressLine1;
                if (origin.addressLine2 !== undefined) load.origin.addressLine2 = origin.addressLine2;
            }
            if (destination) {
                if (destination.addressLine1 !== undefined) load.destination.addressLine1 = destination.addressLine1;
                if (destination.addressLine2 !== undefined) load.destination.addressLine2 = destination.addressLine2;
            }
            await load.save();

            // Reject all other bids for this load
            await Bid.updateMany(
                { load: bid.load._id, _id: { $ne: bid._id } },
                {
                    status: 'Rejected',
                    rejectionReason: 'Another bid was accepted by inhouse user',
                    rejectedAt: new Date()
                }
            );

            // Create tracking record if not exists
            let tracking = await Tracking.findOne({ load: bid.load._id });
            if (!tracking) {
                const originAddress = `${load.origin?.city || ''}, ${load.origin?.state || ''}`;
                const destinationAddress = `${load.destination?.city || ''}, ${load.destination?.state || ''}`;
                const originLatLng = await getLatLngFromAddress(originAddress) || { lat: 0, lon: 0 };
                const destinationLatLng = await getLatLngFromAddress(destinationAddress) || { lat: 0, lon: 0 };
                
                tracking = new Tracking({
                    load: load._id,
                    originLatLng,
                    destinationLatLng,
                    status: 'in_transit',
                    vehicleNumber: bid.vehicleNumber || '',
                    shipmentNumber: load.shipmentNumber || '',
                });
                await tracking.save();
            }

            // Send email notifications
            try {
                // Notify trucker about bid acceptance
                const trucker = await ShipperDriver.findById(bid.carrier);
                if (trucker && trucker.email) {
                    const truckerSubject = '🎉 Your Bid Has Been Accepted!';
                    const truckerHtml = `
                        <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto;">
                          <h2 style="color: #2a7ae2; text-align: center;">🎉 Your Bid Has Been Accepted!</h2>
                          <p style="font-size: 16px; color: #333;">Congratulations! Your bid for the following load has been <b style='color: #27ae60;'>accepted</b> by our inhouse team on behalf of the shipper.</p>
                          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="background: #eaf1fb;"><th colspan="2" style="padding: 8px; text-align: left; font-size: 16px;">Shipment Details</th></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">Shipment Number:</td><td style="padding: 8px;">${load.shipmentNumber || load._id}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">PO Number:</td><td style="padding: 8px;">${load.poNumber || ''}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">BOL Number:</td><td style="padding: 8px;">${load.bolNumber || ''}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">From:</td><td style="padding: 8px;">${load.origin.addressLine1 || ''} ${load.origin.addressLine2 || ''}, ${load.origin.city}, ${load.origin.state}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">To:</td><td style="padding: 8px;">${load.destination.addressLine1 || ''} ${load.destination.addressLine2 || ''}, ${load.destination.city}, ${load.destination.state}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">Accepted Rate:</td><td style="padding: 8px;">$${bid.rate}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">Approved By:</td><td style="padding: 8px;">${req.user.employeeName} (${req.user.department})</td></tr>
                          </table>
                          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; color: #27ae60; font-weight: bold;">✅ Status: Load Assigned</p>
                          </div>
                          <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                            Please proceed with the shipment as per the agreed terms. Contact us if you have any questions!
                          </p>
                        </div>
                    `;

                    await sendEmail({
                        to: trucker.email,
                        subject: truckerSubject,
                        html: truckerHtml
                    });
                }

                // Notify shipper about bid acceptance
                if (load.shipper && load.shipper.email) {
                    const shipperSubject = `Bid Accepted - ${load.origin.city} to ${load.destination.city}`;
                    const shipperHtml = `
                        <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                          <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                            <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">✅ Bid Accepted</h1>
                            <div style="background: #27ae60; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                              <h2 style="margin: 0; font-size: 20px;">Load Assigned Successfully</h2>
                            </div>
                            
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                              <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Assignment Details</h3>
                              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
                                <div>
                                  <strong style="color: #34495e;">📍 Route:</strong><br>
                                  <span style="color: #7f8c8d;">${load.origin.city} → ${load.destination.city}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">🚛 Assigned To:</strong><br>
                                  <span style="color: #7f8c8d;">${trucker?.compName || 'Trucker'}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">💰 Accepted Rate:</strong><br>
                                  <span style="color: #7f8c8d;">$${bid.rate}</span>
                                </div>
                                <div>
                                  <strong style="color: #34495e;">👤 Approved By:</strong><br>
                                  <span style="color: #7f8c8d;">${req.user.employeeName} (${req.user.department})</span>
                                </div>
                                ${shipmentNumber ? `
                                <div>
                                  <strong style="color: #34495e;">📋 Shipment Number:</strong><br>
                                  <span style="color: #7f8c8d;">${shipmentNumber}</span>
                                </div>
                                ` : ''}
                                ${poNumber ? `
                                <div>
                                  <strong style="color: #34495e;">📄 PO Number:</strong><br>
                                  <span style="color: #7f8c8d;">${poNumber}</span>
                                </div>
                                ` : ''}
                                ${bolNumber ? `
                                <div>
                                  <strong style="color: #34495e;">📋 BOL Number:</strong><br>
                                  <span style="color: #7f8c8d;">${bolNumber}</span>
                                </div>
                                ` : ''}
                              </div>
                            </div>
                            
                            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                              <p style="margin: 0; color: #27ae60; font-weight: bold;">✅ Status: Load Assigned</p>
                            </div>
                            
                            <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                              Your load has been successfully assigned by our inhouse team. You can now create a DO (Delivery Order) for this shipment.
                            </p>
                          </div>
                        </div>
                    `;

                    await sendEmail({
                        to: load.shipper.email,
                        subject: shipperSubject,
                        html: shipperHtml
                    });
                }

                console.log(`📧 Bid acceptance notifications sent to trucker and shipper`);
            } catch (emailError) {
                console.error('❌ Error sending bid acceptance notifications:', emailError);
            }

            res.status(200).json({
                success: true,
                message: 'Bid accepted successfully by inhouse user',
                bid,
                load
            });

        } else if (status === 'Rejected') {
            // Reject the bid
            bid.status = 'Rejected';
            bid.rejectedAt = new Date();
            bid.rejectionReason = reason || 'Bid rejected by inhouse user';
            bid.rejectedByInhouseUser = {
                empId: req.user.empId,
                empName: req.user.employeeName,
                dept: req.user.department
            };
            await bid.save();

            // Notify trucker about bid rejection
            try {
                const trucker = await ShipperDriver.findById(bid.carrier);
                if (trucker && trucker.email) {
                    const truckerSubject = 'Bid Status Update';
                    const truckerHtml = `
                        <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto;">
                          <h2 style="color: #e74c3c; text-align: center;">Bid Status Update</h2>
                          <p style="font-size: 16px; color: #333;">Your bid for the following load has been <b style='color: #e74c3c;'>rejected</b> by our inhouse team.</p>
                          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="background: #eaf1fb;"><th colspan="2" style="padding: 8px; text-align: left; font-size: 16px;">Load Details</th></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">From:</td><td style="padding: 8px;">${bid.load.origin.city}, ${bid.load.origin.state}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">To:</td><td style="padding: 8px;">${bid.load.destination.city}, ${bid.load.destination.state}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">Your Rate:</td><td style="padding: 8px;">$${bid.rate}</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">Rejected By:</td><td style="padding: 8px;">${req.user.employeeName} (${req.user.department})</td></tr>
                            <tr><td style="padding: 8px; font-weight: bold;">Reason:</td><td style="padding: 8px;">${reason || 'Not specified'}</td></tr>
                          </table>
                          
                          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="margin: 0; color: #856404; font-weight: bold;">💡 Don't worry! Keep bidding on other loads</p>
                          </div>
                          
                          <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                            Thank you for your interest. Please continue to bid on other available loads!
                          </p>
                        </div>
                    `;

                    await sendEmail({
                        to: trucker.email,
                        subject: truckerSubject,
                        html: truckerHtml
                    });
                }
                console.log(`📧 Bid rejection notification sent to trucker`);
            } catch (emailError) {
                console.error('❌ Error sending bid rejection notification:', emailError);
            }

            res.status(200).json({
                success: true,
                message: 'Bid rejected successfully by inhouse user',
                bid
            });

        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "Accepted" or "Rejected"'
            });
        }

    } catch (error) {
        console.error('❌ Error in acceptBidByInhouseUser:', error);
        next(error);
    }
};