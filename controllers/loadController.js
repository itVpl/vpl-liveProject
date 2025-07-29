import { Load } from '../models/loadModel.js';
import Bid from '../models/bidModel.js';
import mongoose from 'mongoose';
import ShipperDriver from '../models/shipper_driverModel.js';
import { sendEmail } from '../utils/sendEmail.js';
import Tracking from '../models/Tracking.js';

// ✅ Shipper creates a new load
export const createLoad = async (req, res, next) => {
    try {
        const {
            fromCity, fromState,
            toCity, toState,
            weight, commodity, vehicleType, pickupDate, deliveryDate, rate, rateType,
            bidDeadline,
            loadType, // 'OTR' or 'DRAYAGE'
            containerNo, poNumber, bolNumber,
            returnDate, returnLocation
        } = req.body;

        if (!loadType || !['OTR', 'DRAYAGE'].includes(loadType)) {
            return res.status(400).json({ success: false, message: 'loadType (OTR or DRAYAGE) is required.' });
        }
        if (loadType === 'DRAYAGE' && (!returnDate || !returnLocation)) {
            return res.status(400).json({ success: false, message: 'returnDate and returnLocation are required for DRAYAGE loads.' });
        }

        if (!req.user || !req.user._id) {
            return res.status(401).json({ success: false, message: 'User not authenticated or shipper ID missing.' });
        }

        const newLoad = new Load({
            shipper: req.user._id, // Always set shipper
            origin: {
                city: fromCity,
                state: fromState,
            },
            destination: {
                city: toCity,
                state: toState,
            },
            weight,
            commodity,
            vehicleType,
            pickupDate,
            deliveryDate,
            rate,
            rateType,
            bidDeadline,
            loadType,
            containerNo,
            poNumber,
            bolNumber,
            returnDate: loadType === 'DRAYAGE' ? returnDate : null,
            returnLocation: loadType === 'DRAYAGE' ? returnLocation : '',
        });

        await newLoad.save();

        // Send email notification to all approved truckers
        try {
            const truckers = await ShipperDriver.find({ userType: 'trucker', status: 'approved' }, 'email compName');
            const subject = `New Load Posted by Shipper`;
            const html = `
                <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto;">
                  <h2 style="color: #2a7ae2; text-align: center;">🚚 New Load Posted!</h2>
                  <p style="font-size: 16px; color: #333;">A new load has been posted by a shipper. Check out the details below and place your bid!</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="background: #eaf1fb;"><th colspan="2" style="padding: 8px; text-align: left; font-size: 16px;">Load Details</th></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">From:</td><td style="padding: 8px;">${fromCity}, ${fromState}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">To:</td><td style="padding: 8px;">${toCity}, ${toState}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Commodity:</td><td style="padding: 8px;">${commodity}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Vehicle Type:</td><td style="padding: 8px;">${vehicleType}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Weight:</td><td style="padding: 8px;">${weight} kg</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Pickup Date:</td><td style="padding: 8px;">${pickupDate ? new Date(pickupDate).toLocaleDateString() : ''}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Delivery Date:</td><td style="padding: 8px;">${deliveryDate ? new Date(deliveryDate).toLocaleDateString() : ''}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Load Type:</td><td style="padding: 8px;">${loadType}</td></tr>
                    ${loadType === 'DRAYAGE' ? `<tr><td style='padding: 8px; font-weight: bold;'>Return Date:</td><td style='padding: 8px;'>${returnDate ? new Date(returnDate).toLocaleDateString() : ''}</td></tr>` : ''}
                    ${loadType === 'DRAYAGE' ? `<tr><td style='padding: 8px; font-weight: bold;'>Return Location:</td><td style='padding: 8px;'>${returnLocation}</td></tr>` : ''}
                  </table>
                  <p style="font-size: 15px; color: #555;">Login to your <a href='https://vpl.com' style='color: #2a7ae2; text-decoration: underline;'>VPL account</a> to place a bid!</p>
                </div>
            `;
            for (const trucker of truckers) {
                await sendEmail({
                    to: trucker.email,
                    subject,
                    html
                });
            }
            console.log(`📧 Notification sent to ${truckers.length} truckers.`);
        } catch (emailErr) {
            console.error('❌ Error sending trucker notifications:', emailErr);
        }

        res.status(201).json({
            success: true,
            message: 'Load posted successfully on load board',
            load: newLoad,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get all available loads for truckers (load board)
export const getAvailableLoads = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            originCity,
            destinationCity,
            vehicleType,
            minWeight,
            maxWeight,
            minRate,
            maxRate,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const filter = { status: { $in: ['Posted', 'Bidding'] } };

        // Apply filters
        if (originCity) {
            filter['origin.city'] = { $regex: originCity, $options: 'i' };
        }
        if (destinationCity) {
            filter['destination.city'] = { $regex: destinationCity, $options: 'i' };
        }
        if (vehicleType) {
            filter.vehicleType = vehicleType;
        }
        if (minWeight || maxWeight) {
            filter.weight = {};
            if (minWeight) filter.weight.$gte = Number(minWeight);
            if (maxWeight) filter.weight.$lte = Number(maxWeight);
        }
        if (minRate || maxRate) {
            filter.rate = {};
            if (minRate) filter.rate.$gte = Number(minRate);
            if (maxRate) filter.rate.$lte = Number(maxRate);
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const loads = await Load.find(filter)
            .populate('shipper', 'compName mc_dot_no city state')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Load.countDocuments(filter);

        res.status(200).json({
            success: true,
            loads,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalLoads: total,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get loads by shipper
export const getShipperLoads = async (req, res, next) => {
    try {
        
        
        if (!req.user) {
            return res.status(400).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        if (!req.user._id) {
            return res.status(400).json({
                success: false,
                message: 'User ID not found in request',
            });
        }

        // Handle different ObjectId formats
        let userId;
        try {
            // If it's already a string, use it directly
            if (typeof req.user._id === 'string') {
                userId = req.user._id;
            } else {
                // If it's an ObjectId, convert to string
                userId = req.user._id.toString();
            }
            
            // Validate if it's a valid ObjectId format
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid user ID format',
                });
            }
        } catch (error) {
            console.error('❌ Error converting user ID:', error);
            return res.status(400).json({
                success: false,
                message: 'Error processing user ID',
            });
        }

        console.log('🔍 Debug - Final userId:', userId);

        // Try to find loads with proper error handling
        const loads = await Load.find({ shipper: userId })
            .populate('assignedTo', 'compName mc_dot_no')
            .populate('acceptedBid')
            .sort({ createdAt: -1 })
            .exec();

        console.log('🔍 Debug - Found loads count:', loads.length);

        res.status(200).json({
            success: true,
            loads,
            totalLoads: loads.length,
        });
    } catch (error) {
        console.error('❌ Error in getShipperLoads:', error);
        console.error('❌ Error stack:', error.stack);
        
        // Check if it's a MongoDB validation error
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error: ' + error.message,
            });
        }
        
        // Check if it's a MongoDB cast error
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format: ' + error.message,
            });
        }
        
        next(error);
    }
};

// ✅ Get loads assigned to trucker
export const getTruckerLoads = async (req, res, next) => {
    try {
        // Debug: Check user object
        console.log('User object:', req.user);
        console.log('User ID:', req.user?._id);
        
        if (!req.user || !req.user._id) {
            return res.status(400).json({
                success: false,
                message: 'User not authenticated or user ID not found',
            });
        }

        const loads = await Load.find({ assignedTo: req.user._id })
            .populate('shipper', 'compName mc_dot_no')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            loads,
            totalLoads: loads.length,
        });
    } catch (error) {
        console.error('Error in getTruckerLoads:', error);
        next(error);
    }
};

// ✅ Get single load details
export const getLoadDetails = async (req, res, next) => {
    try {
        const load = await Load.findById(req.params.id)
            .populate('shipper', 'compName mc_dot_no city state phoneNo email')
            .populate('assignedTo', 'compName mc_dot_no city state phoneNo email')
            .populate('acceptedBid');

        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found',
            });
        }

        res.status(200).json({
            success: true,
            load,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Update load status
export const updateLoadStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const load = await Load.findById(req.params.id);
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found',
            });
        }
        // Only assigned driver can update status
        if (!req.user || !load.assignedTo || load.assignedTo.toString() !== req.user._id.toString() || req.user.userType !== 'trucker') {
            return res.status(403).json({
                success: false,
                message: 'Only assigned driver can update status',
            });
        }
        load.status = status;
        await load.save();
        // If delivered, update tracking status too
        if (status === 'Delivered' || status === 'delivered') {
            const Tracking = (await import('../models/Tracking.js')).default;
            await Tracking.findOneAndUpdate(
                { load: load._id },
                { status: 'delivered', endedAt: new Date() }
            );
        }
        res.status(200).json({
            success: true,
            message: 'Load status updated successfully',
            load,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Cancel load
export const cancelLoad = async (req, res, next) => {
    try {
        const load = await Load.findById(req.params.id);

        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found',
            });
        }

        if (load.shipper.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only shipper can cancel the load',
            });
        }

        if (load.status === 'Assigned' || load.status === 'In Transit') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel assigned or in-transit load',
            });
        }

        load.status = 'Cancelled';
        await load.save();

        res.status(200).json({
            success: true,
            message: 'Load cancelled successfully',
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Search loads
export const searchLoads = async (req, res, next) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required',
            });
        }

        const loads = await Load.find({
            $and: [
                { status: { $in: ['Posted', 'Bidding'] } },
                {
                    $or: [
                        { 'origin.city': { $regex: q, $options: 'i' } },
                        { 'destination.city': { $regex: q, $options: 'i' } },
                        { commodity: { $regex: q, $options: 'i' } },
                        { vehicleType: { $regex: q, $options: 'i' } },
                        { specialRequirements: { $regex: q, $options: 'i' } },
                    ]
                }
            ]
        })
        .populate('shipper', 'compName mc_dot_no city state')
        .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            loads,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get load statistics
export const getLoadStats = async (req, res, next) => {
    try {
        const stats = await Load.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalLoads = await Load.countDocuments();
        const totalBids = await Bid.countDocuments();

        res.status(200).json({
            success: true,
            stats,
            totalLoads,
            totalBids,
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Test endpoint to check Load model and database
export const testLoadModel = async (req, res, next) => {
    try {
        console.log('🔍 Debug - Testing Load model...');
        
        // Test 1: Check if Load model exists
        console.log('🔍 Debug - Load model:', Load);
        
        // Test 2: Try to count all loads
        const totalLoads = await Load.countDocuments();
        console.log('🔍 Debug - Total loads in database:', totalLoads);
        
        // Test 3: Try to find any load
        const anyLoad = await Load.findOne();
        console.log('🔍 Debug - Any load found:', anyLoad ? 'Yes' : 'No');
        
        res.status(200).json({
            success: true,
            message: 'Load model test completed',
            data: {
                modelExists: !!Load,
                totalLoads,
                anyLoadFound: !!anyLoad
            }
        });
    } catch (error) {
        console.error('❌ Error in testLoadModel:', error);
        next(error);
    }
};

// ✅ Test endpoint to verify user authentication
export const testUserAuth = async (req, res, next) => {
    try {
        console.log('🔍 Debug - Full request user object:', req.user);
        console.log('🔍 Debug - User ID:', req.user?._id);
        console.log('🔍 Debug - User type:', req.user?.userType);
        console.log('🔍 Debug - User status:', req.user?.status);
        
        res.status(200).json({
            success: true,
            message: 'User authentication test',
            user: {
                id: req.user?._id,
                userType: req.user?.userType,
                status: req.user?.status,
                compName: req.user?.compName,
                email: req.user?.email
            }
        });
    } catch (error) {
        console.error('❌ Error in testUserAuth:', error);
        next(error);
    }
};

// Driver uploads proof images
export const uploadProofOfDelivery = async (req, res, next) => {
  try {
    const load = await Load.findById(req.params.id);
    if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
    if (load.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only assigned driver can upload proof' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    // Get URLs from uploaded files (S3 or local)
    const fileUrls = req.files.map(file => file.location || file.path);
    load.proofOfDelivery = fileUrls;
    load.status = 'POD_uploaded';
    await load.save();
    res.status(200).json({ success: true, message: 'Proof uploaded', proof: fileUrls, load });
  } catch (error) { next(error); }
};

// Shipper approves delivery
export const approveDelivery = async (req, res, next) => {
  try {
    const load = await Load.findById(req.params.id).populate('shipper assignedTo');
    if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
    if (load.shipper._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only shipper can approve delivery' });
    }
    if (!load.proofOfDelivery || load.proofOfDelivery.length === 0) {
      return res.status(400).json({ success: false, message: 'No proof uploaded by driver' });
    }
    if (load.status !== 'POD_uploaded') {
      return res.status(400).json({ success: false, message: 'Delivery can only be approved after POD is uploaded.' });
    }
    load.status = 'Delivered';
    load.deliveryApproval = true;
    await load.save();

    // Send notification/email to shipper and trucker
    try {
      const { sendEmail } = await import('../utils/sendEmail.js');
      // Email to shipper
      if (load.shipper.email) {
        await sendEmail({
          to: load.shipper.email,
          subject: '✅ Delivery Verified & Completed',
          html: `<p>Your load (Shipment No: ${load.shipmentNumber || load._id}) has been delivered and verified by inhouse team.</p>`
        });
      }
      // Email to trucker
      if (load.assignedTo && load.assignedTo.email) {
        await sendEmail({
          to: load.assignedTo.email,
          subject: '✅ Delivery Verified & Completed',
          html: `<p>Your assigned load (Shipment No: ${load.shipmentNumber || load._id}) has been delivered and verified by shipper.</p>`
        });
      }
    } catch (err) {
      console.error('❌ Error sending delivery notification emails:', err);
    }

    res.status(200).json({ success: true, message: 'Delivery approved', load });
  } catch (error) { next(error); }
};

// TEMP: Create tracking record for a load (admin/dev use only)
export const createTrackingForLoad = async (req, res, next) => {
  try {
    const load = await Load.findById(req.params.id);
    if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
    // Check if already exists
    let tracking = await Tracking.findOne({ load: load._id });
    if (tracking) return res.status(200).json({ success: true, message: 'Tracking already exists', tracking });
    // Try to get lat/lon from load.origin/destination
    const originLatLng = {
      lat: load.origin?.lat || 0,
      lon: load.origin?.lon || 0,
    };
    const destinationLatLng = {
      lat: load.destination?.lat || 0,
      lon: load.destination?.lon || 0,
    };
    tracking = new Tracking({
      load: load._id,
      originLatLng,
      destinationLatLng,
      status: 'in_transit',
      vehicleNumber: load.vehicleNumber || '',
      shipmentNumber: load.shipmentNumber || '',
    });
    await tracking.save();
    res.status(201).json({ success: true, message: 'Tracking created', tracking });
  } catch (error) { next(error); }
};

// Get all shipments from Tracking table
export const getAllTrackings = async (req, res, next) => {
  try {
    const Tracking = (await import('../models/Tracking.js')).default;
    const trackings = await Tracking.find()
      .populate({
        path: 'load',
        populate: [
          { path: 'shipper', select: 'compName email' },
          { path: 'assignedTo', select: 'compName email' }
        ]
      });
    res.status(200).json({ success: true, trackings });
  } catch (error) {
    next(error);
  }
};

// Update existing loads with geocoding (admin/dev use)
export const updateLoadsWithGeocoding = async (req, res, next) => {
  try {
    const { getLatLngFromAddress } = await import('../utils/geocode.js');
    
    // Get all loads that don't have geocoded coordinates
    const loads = await Load.find({
      $or: [
        { 'origin.lat': { $exists: false } },
        { 'origin.lon': { $exists: false } },
        { 'destination.lat': { $exists: false } },
        { 'destination.lon': { $exists: false } }
      ]
    });

    console.log(`🔍 Found ${loads.length} loads to update with geocoding`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const load of loads) {
      try {
        // Prepare full address strings
        const originAddress = `${load.origin.city}, ${load.origin.state}`.trim();
        const destinationAddress = `${load.destination.city}, ${load.destination.state}`.trim();

        // Geocode origin and destination
        const originLatLng = await getLatLngFromAddress(originAddress);
        const destinationLatLng = await getLatLngFromAddress(destinationAddress);

        if (originLatLng && destinationLatLng) {
          // Update load with geocoded coordinates
          await Load.findByIdAndUpdate(load._id, {
            'origin.lat': originLatLng.lat,
            'origin.lon': originLatLng.lon,
            'destination.lat': destinationLatLng.lat,
            'destination.lon': destinationLatLng.lon
          });
          updatedCount++;
          console.log(`✅ Updated load ${load._id} with geocoding`);
        } else {
          console.log(`❌ Geocoding failed for load ${load._id}`);
          errorCount++;
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error updating load ${load._id}:`, error.message);
        errorCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Geocoding update completed',
      data: {
        totalLoads: loads.length,
        updatedCount,
        errorCount
      }
    });
  } catch (error) {
    console.error('❌ Error in updateLoadsWithGeocoding:', error);
    next(error);
  }
};

export const getTrackingByShipmentNumber = async (req, res, next) => {
    try {
      const { shipmentNumber } = req.params;
  
      if (!shipmentNumber) {
        return res.status(400).json({
          success: false,
          message: 'Shipment number is required',
        });
      }
  
      const tracking = await Tracking.findOne({ shipmentNumber })
        .populate({
          path: 'load',
          populate: [
            { path: 'shipper', select: 'compName email' },
            { path: 'assignedTo', select: 'compName email' }
          ]
        });
  
      if (!tracking) {
        return res.status(404).json({
          success: false,
          message: 'Tracking not found for given shipment number',
        });
      }
  
      res.status(200).json({
        success: true,
        tracking,
      });
    } catch (error) {
      next(error);
    }
  };

// ✅ Driver upload images at pickup point
export const uploadPickupImages = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        const { notes, driverId } = req.body;
        
        // Use driverId from body if provided, otherwise use authenticated user
        const actualDriverId = driverId || (req.user ? req.user._id : null);
        
        if (!actualDriverId) {
            return res.status(401).json({
                success: false,
                message: 'Driver ID is required'
            });
        }

        const load = await Load.findOne({ shipmentNumber });
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }

        // Check if driver is assigned to this load
        if (load.assignedTo?.toString() !== actualDriverId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to upload images for this load'
            });
        }

        // Check if load status allows image upload (more flexible)
        const allowedStatuses = ['Assigned', 'In Transit', 'POD_uploaded'];
        if (!allowedStatuses.includes(load.status)) {
            return res.status(400).json({
                success: false,
                message: `Load status '${load.status}' does not allow image upload at this stage. Allowed statuses: ${allowedStatuses.join(', ')}`
            });
        }

        // Handle files from req.files array (multer.any() returns array)
        const files = req.files || [];
        
        // Group files by fieldname
        const uploadedImages = {
            emptyTruckImages: files.filter(f => f.fieldname === 'emptyTruckImages').map(f => f.path || f.location),
            eirTickets: files.filter(f => f.fieldname === 'eirTickets').map(f => f.path || f.location),
            containerImages: files.filter(f => f.fieldname === 'containerImages').map(f => f.path || f.location),
            sealImages: files.filter(f => f.fieldname === 'sealImages').map(f => f.path || f.location),
            notes: notes || ''
        };

        // Log for debugging
        console.log('📸 Debug - Files received:', {
            totalFiles: files.length,
            fileNames: files.map(f => f.fieldname),
            emptyTruckImages: uploadedImages.emptyTruckImages.length,
            eirTickets: uploadedImages.eirTickets.length,
            containerImages: uploadedImages.containerImages.length,
            sealImages: uploadedImages.sealImages.length
        });

        // Update load with pickup images
        const updatedLoad = await Load.findOneAndUpdate(
            { shipmentNumber },
            {
                $push: {
                    emptyTruckImages: { $each: uploadedImages.emptyTruckImages },
                    eirTickets: { $each: uploadedImages.eirTickets },
                    containerImages: { $each: uploadedImages.containerImages },
                    sealImages: { $each: uploadedImages.sealImages }
                },
                $set: {
                    notes: uploadedImages.notes,
                    'originPlace.status': 1,
                    'originPlace.arrivedAt': new Date(),
                    'originPlace.location': `${load.origin.city}, ${load.origin.state}`,
                    status: 'In Transit'
                }
            },
            { new: true }
        ).populate('shipper', 'compName email');

        // Send notification to shipper
        try {
            const subject = `🚛 Driver Arrived at Pickup Point - Load #${shipmentNumber}`;
            const html = `
                <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto;">
                    <h2 style="color: #2a7ae2; text-align: center;">📸 Pickup Images Uploaded</h2>
                    <p style="font-size: 16px; color: #333;">Your driver has arrived at the pickup point and uploaded the following images:</p>
                    <ul style="font-size: 14px; color: #555;">
                        <li>Empty truck photos: ${uploadedImages.emptyTruckImages.length} images</li>
                        <li>EIR tickets: ${uploadedImages.eirTickets.length} images</li>
                        <li>Container condition: ${uploadedImages.containerImages.length} images</li>
                        <li>Seal images: ${uploadedImages.sealImages.length} images</li>
                    </ul>
                    <p style="font-size: 14px; color: #666;"><strong>Driver Notes:</strong> ${uploadedImages.notes || 'No notes provided'}</p>
                    <p style="font-size: 15px; color: #555;">Login to your <a href='https://vpl.com' style='color: #2a7ae2; text-decoration: underline;'>VPL account</a> to view the images!</p>
                </div>
            `;
            
            await sendEmail({
                to: load.shipper.email,
                subject,
                html
            });
        } catch (emailErr) {
            console.error('❌ Error sending pickup notification:', emailErr);
        }

        res.status(200).json({
            success: true,
            message: 'Pickup images uploaded successfully',
            load: updatedLoad,
            uploadedImages: {
                emptyTruckImages: uploadedImages.emptyTruckImages.length,
                eirTickets: uploadedImages.eirTickets.length,
                containerImages: uploadedImages.containerImages.length,
                sealImages: uploadedImages.sealImages.length
            }
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Driver upload loaded truck images
export const uploadLoadedTruckImages = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        const { notes, driverId } = req.body;
        
        // Use driverId from body if provided, otherwise use authenticated user
        const actualDriverId = driverId || (req.user ? req.user._id : null);
        
        if (!actualDriverId) {
            return res.status(401).json({
                success: false,
                message: 'Driver ID is required'
            });
        }

        const load = await Load.findOne({ shipmentNumber });
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }

        // Check if driver is assigned to this load
        if (load.assignedTo?.toString() !== actualDriverId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to upload images for this load'
            });
        }

        // Check if load status allows loaded truck image upload
        if (load.status !== 'In Transit') {
            return res.status(400).json({
                success: false,
                message: 'Load must be in transit to upload loaded truck images'
            });
        }

        // Handle files from req.files array
        const files = req.files || [];
        
        const loadedTruckImages = files.filter(f => f.fieldname === 'loadedTruckImages').map(f => f.path || f.location);
        const damageImages = files.filter(f => f.fieldname === 'damageImages').map(f => f.path || f.location);

        // Update load with loaded truck images
        const updatedLoad = await Load.findOneAndUpdate(
            { shipmentNumber },
            {
                $push: {
                    loadedTruckImages: { $each: loadedTruckImages },
                    damageImages: { $each: damageImages }
                },
                $set: {
                    notes: notes || load.notes
                }
            },
            { new: true }
        ).populate('shipper', 'compName email');

        // Send notification to shipper
        try {
            const subject = `📦 Loaded Truck Images - Load #${shipmentNumber}`;
            const html = `
                <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto;">
                    <h2 style="color: #2a7ae2; text-align: center;">🚛 Truck Loaded Successfully</h2>
                    <p style="font-size: 16px; color: #333;">Your driver has uploaded loaded truck images:</p>
                    <ul style="font-size: 14px; color: #555;">
                        <li>Loaded truck photos: ${loadedTruckImages.length} images</li>
                        <li>Damage documentation: ${damageImages.length} images</li>
                    </ul>
                    <p style="font-size: 14px; color: #666;"><strong>Driver Notes:</strong> ${notes || 'No notes provided'}</p>
                    <p style="font-size: 15px; color: #555;">Login to your <a href='https://vpl.com' style='color: #2a7ae2; text-decoration: underline;'>VPL account</a> to view the images!</p>
                </div>
            `;
            
            await sendEmail({
                to: load.shipper.email,
                subject,
                html
            });
        } catch (emailErr) {
            console.error('❌ Error sending loaded truck notification:', emailErr);
        }

        res.status(200).json({
            success: true,
            message: 'Loaded truck images uploaded successfully',
            load: updatedLoad,
            uploadedImages: {
                loadedTruckImages: loadedTruckImages.length,
                damageImages: damageImages.length
            }
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Driver upload POD images at delivery
export const uploadPODImages = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        const { notes, driverId } = req.body;
        
        // Comprehensive debugging
        console.log('🔍 POD Upload - Full request debug:', {
            params: req.params,
            body: req.body,
            files: req.files,
            headers: {
                'content-type': req.headers['content-type'],
                'content-length': req.headers['content-length']
            }
        });
        
        // Use driverId from body if provided, otherwise use authenticated user
        const actualDriverId = driverId || (req.user ? req.user._id : null);
        
        if (!actualDriverId) {
            return res.status(401).json({
                success: false,
                message: 'Driver ID is required'
            });
        }

        const load = await Load.findOne({ shipmentNumber });
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }

        // Check if driver is assigned to this load
        if (load.assignedTo?.toString() !== actualDriverId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to upload images for this load'
            });
        }

        // Real-time status check
        console.log('🔍 POD Upload - Real-time status check:', {
            loadStatus: load.status,
            expectedStatus: 'In Transit',
            isEqual: load.status === 'In Transit',
            loadStatusType: typeof load.status,
            loadId: load._id,
            shipmentNumber: load.shipmentNumber,
            updatedAt: load.updatedAt
        });

        // Check if load status allows POD upload (case-insensitive)
        const allowedStatuses = ['in transit', 'pod_uploaded'];
        if (!allowedStatuses.includes(load.status?.trim().toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Load must be in transit or already have POD uploaded to add more POD images',
                debug: {
                    currentStatus: load.status,
                    allowedStatuses: allowedStatuses,
                    currentStatusTrimmed: load.status?.trim(),
                    currentStatusLower: load.status?.toLowerCase(),
                    loadId: load._id,
                    shipmentNumber: load.shipmentNumber
                }
            });
        }

        // Handle files from req.files array
        const files = req.files || {};
        
        // Add debugging for files
        console.log('📸 POD Upload - Files received:', {
            filesType: typeof req.files,
            filesIsArray: Array.isArray(req.files),
            filesKeys: Object.keys(req.files || {}),
            filesObject: req.files
        });
        
        // Handle files from multer fields configuration
        let podImages = [];
        if (req.files && req.files.podImages) {
            podImages = req.files.podImages.map(f => f.path || f.location);
        } else if (req.files && req.files.pod) {
            podImages = req.files.pod.map(f => f.path || f.location);
        } else if (req.files && req.files.proofOfDelivery) {
            podImages = req.files.proofOfDelivery.map(f => f.path || f.location);
        } else if (Array.isArray(req.files)) {
            // Fallback for .any() configuration
            podImages = req.files.filter(f => {
                const fieldname = f.fieldname?.toLowerCase();
                return fieldname === 'podimages' || 
                       fieldname === 'pod_images' || 
                       fieldname === 'pod' ||
                       fieldname === 'proofofdelivery' ||
                       fieldname === 'proof_of_delivery';
            }).map(f => f.path || f.location);
        }
        
        const deliveryNotes = req.body.deliveryNotes || '';

        console.log('📸 POD Upload - Processed podImages:', {
            podImagesCount: podImages.length,
            podImagesPaths: podImages,
            allFieldNames: Array.isArray(req.files) ? req.files.map(f => f.fieldname) : Object.keys(req.files || {})
        });

        // Update load with POD images
        const updatedLoad = await Load.findOneAndUpdate(
            { shipmentNumber },
            {
                $push: {
                    podImages: { $each: podImages }
                },
                $set: {
                    notes: notes || load.notes,
                    'destinationPlace.status': 1,
                    'destinationPlace.arrivedAt': new Date(),
                    'destinationPlace.location': `${load.destination.city}, ${load.destination.state}`,
                    'destinationPlace.notes': deliveryNotes,
                    status: 'POD_uploaded'
                }
            },
            { new: true }
        ).populate('shipper', 'compName email');

        // Send notification to shipper
        try {
            const subject = `📋 POD Images Uploaded - Load #${shipmentNumber}`;
            const html = `
                <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto;">
                    <h2 style="color: #2a7ae2; text-align: center;">✅ Delivery Completed</h2>
                    <p style="font-size: 16px; color: #333;">Your driver has uploaded POD images for delivery:</p>
                    <ul style="font-size: 14px; color: #555;">
                        <li>POD images: ${podImages.length} images</li>
                    </ul>
                    <p style="font-size: 14px; color: #666;"><strong>Driver Notes:</strong> ${notes || 'No notes provided'}</p>
                    <p style="font-size: 14px; color: #666;"><strong>Delivery Notes:</strong> ${deliveryNotes || 'No delivery notes'}</p>
                    <p style="font-size: 15px; color: #555;">Login to your <a href='https://vpl.com' style='color: #2a7ae2; text-decoration: underline;'>VPL account</a> to review and approve the delivery!</p>
                </div>
            `;
            
            await sendEmail({
                to: load.shipper.email,
                subject,
                html
            });
        } catch (emailErr) {
            console.error('❌ Error sending POD notification:', emailErr);
        }

        res.status(200).json({
            success: true,
            message: 'POD images uploaded successfully',
            load: updatedLoad,
            uploadedImages: {
                podImages: podImages.length
            }
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Upload drop location images (POD, loaded truck, drop location, empty truck)
export const uploadDropLocationImages = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        const { notes, driverId } = req.body;
        
        console.log('📸 Drop Location Upload - Request received:', {
            shipmentNumber,
            notes,
            driverId,
            files: req.files ? Object.keys(req.files) : 'No files'
        });
        
        // Use driverId from body if provided, otherwise use authenticated user
        const actualDriverId = driverId || (req.user ? req.user._id : null);
        
        if (!actualDriverId) {
            return res.status(401).json({
                success: false,
                message: 'Driver ID is required'
            });
        }

        const load = await Load.findOne({ shipmentNumber });
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }

        // Check if driver is assigned to this load
        if (load.assignedTo?.toString() !== actualDriverId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to upload images for this load'
            });
        }

        // Check if load status allows drop location image upload
        const allowedStatuses = ['In Transit', 'POD_uploaded'];
        if (!allowedStatuses.includes(load.status)) {
            return res.status(400).json({
                success: false,
                message: `Load status '${load.status}' does not allow drop location image upload. Allowed statuses: ${allowedStatuses.join(', ')}`
            });
        }

        // Handle files from multer fields configuration
        const files = req.files || {};
        
        // Process different types of images
        const podImages = files.podImages ? files.podImages.map(f => f.path || f.location) : [];
        const loadedTruckImages = files.loadedTruckImages ? files.loadedTruckImages.map(f => f.path || f.location) : [];
        const dropLocationImages = files.dropLocationImages ? files.dropLocationImages.map(f => f.path || f.location) : [];
        const emptyTruckImages = files.emptyTruckImages ? files.emptyTruckImages.map(f => f.path || f.location) : [];

        // Validate that at least some images are uploaded
        const totalImages = podImages.length + loadedTruckImages.length + dropLocationImages.length + emptyTruckImages.length;
        if (totalImages === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one image is required (POD, loaded truck, drop location, or empty truck)'
            });
        }

        console.log('📸 Drop Location Upload - Processed images:', {
            podImages: podImages.length,
            loadedTruckImages: loadedTruckImages.length,
            dropLocationImages: dropLocationImages.length,
            emptyTruckImages: emptyTruckImages.length,
            totalImages
        });

        // Update load with drop location images and set status to Delivered
        const updateData = {
            'dropLocationImages.podImages': podImages,
            'dropLocationImages.loadedTruckImages': loadedTruckImages,
            'dropLocationImages.dropLocationImages': dropLocationImages,
            'dropLocationImages.emptyTruckImages': emptyTruckImages,
            'dropLocationImages.notes': notes || '',
            dropLocationArrivalTime: new Date(),
            dropLocationCompleted: true,
            status: 'Delivered', // Automatically set status to Delivered
            deliveryApproval: true // Mark as delivery approved
        };

        // Only update destination place if not already set
        if (!load.destinationPlace.status) {
            updateData['destinationPlace.status'] = 1;
            updateData['destinationPlace.arrivedAt'] = new Date();
            updateData['destinationPlace.location'] = `${load.destination.city}, ${load.destination.state}`;
        }

        const updatedLoad = await Load.findOneAndUpdate(
            { shipmentNumber },
            updateData,
            { new: true }
        ).populate('shipper', 'compName email');

        // Update tracking status to delivered
        try {
            const tracking = await Tracking.findOne({ load: updatedLoad._id });
            if (tracking) {
                tracking.status = 'delivered';
                tracking.endedAt = new Date();
                await tracking.save();
                console.log('✅ Tracking status updated to delivered for load:', updatedLoad._id);
            } else {
                console.log('⚠️ No tracking record found for load:', updatedLoad._id);
            }
        } catch (trackingError) {
            console.error('❌ Error updating tracking status:', trackingError);
        }

        // Send notification to shipper
        try {
            const subject = `✅ Delivery Completed - Shipment ${shipmentNumber}`;
            const html = `
                <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto;">
                    <h2 style="color: #28a745; text-align: center;">🎉 Delivery Successfully Completed!</h2>
                    <p style="font-size: 16px; color: #333;">Your shipment ${shipmentNumber} has been <strong>automatically marked as DELIVERED</strong> after the driver uploaded drop location images:</p>
                    <ul style="font-size: 14px; color: #555;">
                        <li>POD images: ${podImages.length} images</li>
                        <li>Loaded truck images: ${loadedTruckImages.length} images</li>
                        <li>Drop location images: ${dropLocationImages.length} images</li>
                        <li>Empty truck images: ${emptyTruckImages.length} images</li>
                    </ul>
                    <p style="font-size: 14px; color: #666;"><strong>Driver Notes:</strong> ${notes || 'No notes provided'}</p>
                    <p style="font-size: 15px; color: #555;">The delivery has been automatically approved. Login to your <a href='https://vpl.com' style='color: #2a7ae2; text-decoration: underline;'>VPL account</a> to view the complete delivery details!</p>
                </div>
            `;
            
            await sendEmail({
                to: load.shipper.email,
                subject,
                html
            });
        } catch (emailErr) {
            console.error('❌ Error sending drop location notification:', emailErr);
        }

        res.status(200).json({
            success: true,
            message: 'Drop location images uploaded successfully and delivery marked as completed!',
            load: updatedLoad,
            uploadedImages: {
                podImages: podImages.length,
                loadedTruckImages: loadedTruckImages.length,
                dropLocationImages: dropLocationImages.length,
                emptyTruckImages: emptyTruckImages.length,
                totalImages
            },
            deliveryStatus: 'Automatically marked as Delivered',
            trackingStatus: 'Updated to delivered'
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get load images for driver/shipper
export const getLoadImages = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        const { driverId, shipperId } = req.query;
        
        // Use IDs from query if provided, otherwise use authenticated user
        const actualDriverId = driverId || (req.user ? req.user._id : null);
        const actualShipperId = shipperId || (req.user ? req.user._id : null);

        const load = await Load.findOne({ shipmentNumber })
            .populate('shipper', 'compName')
            .populate('assignedTo', 'compName');

        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }

        // Check if user is authorized to view images
        const isShipper = load.shipper?._id.toString() === actualShipperId?.toString();
        const isDriver = load.assignedTo?._id.toString() === actualDriverId?.toString();
        
        if (!isShipper && !isDriver) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view images for this load'
            });
        }

        const images = {
            emptyTruckImages: load.emptyTruckImages || [],
            loadedTruckImages: load.loadedTruckImages || [],
            podImages: load.podImages || [],
            eirTickets: load.eirTickets || [],
            containerImages: load.containerImages || [],
            sealImages: load.sealImages || [],
            damageImages: load.damageImages || [],
            notes: load.notes || '',
            originPlace: load.originPlace,
            destinationPlace: load.destinationPlace,
            dropLocationImages: load.dropLocationImages || {
                podImages: [],
                loadedTruckImages: [],
                dropLocationImages: [],
                emptyTruckImages: [],
                notes: ''
            },
            dropLocationArrivalTime: load.dropLocationArrivalTime,
            dropLocationCompleted: load.dropLocationCompleted || false
        };

        res.status(200).json({
            success: true,
            images,
            loadStatus: load.status,
            shipmentNumber: load.shipmentNumber
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Test authentication endpoint
export const testAuth = async (req, res, next) => {
    try {
        console.log('🔍 Debug - req.user:', req.user);
        console.log('🔍 Debug - req.headers.authorization:', req.headers.authorization);
        
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'No user found in request'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Authentication successful',
            user: {
                id: req.user._id,
                email: req.user.email,
                userType: req.user.userType,
                status: req.user.status,
                compName: req.user.compName
            }
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Debug file upload endpoint
export const debugFileUpload = async (req, res, next) => {
    try {
        console.log('🔍 Debug - req.files:', req.files);
        console.log('🔍 Debug - req.body:', req.body);
        console.log('🔍 Debug - req.headers:', req.headers);
        
        res.status(200).json({
            success: true,
            message: 'Debug information',
            files: req.files ? Object.keys(req.files) : 'No files',
            body: req.body,
            contentType: req.headers['content-type']
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Simple test endpoint without files
export const testPickupWithoutFiles = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        const { notes, driverId } = req.body;
        
        console.log('🧪 Test - Request received:', {
            shipmentNumber,
            notes,
            driverId,
            files: req.files ? Object.keys(req.files) : 'No files'
        });
        
        if (!driverId) {
            return res.status(400).json({
                success: false,
                message: 'Driver ID is required'
            });
        }

        const load = await Load.findOne({ shipmentNumber });
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }

        // Check if driver is assigned to this load
        if (load.assignedTo?.toString() !== driverId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to upload images for this load'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Test successful - Driver authorized',
            load: {
                shipmentNumber: load.shipmentNumber,
                origin: load.origin,
                destination: load.destination,
                status: load.status,
                assignedTo: load.assignedTo
            },
            driverId,
            notes
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Test load status endpoint
export const testLoadStatus = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        
        const load = await Load.findOne({ shipmentNumber });
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }

        console.log('🔍 Debug - Load status details:', {
            loadId: load._id,
            shipmentNumber: load.shipmentNumber,
            status: load.status,
            statusType: typeof load.status,
            statusLength: load.status ? load.status.length : 0,
            statusBytes: load.status ? Buffer.from(load.status).toString('hex') : 'null'
        });

        res.status(200).json({
            success: true,
            message: 'Load status check',
            load: {
                id: load._id,
                shipmentNumber: load.shipmentNumber,
                status: load.status,
                statusType: typeof load.status,
                origin: load.origin,
                destination: load.destination,
                assignedTo: load.assignedTo
            },
            statusCheck: {
                isInTransit: load.status === 'In Transit',
                isAssigned: load.status === 'Assigned',
                isPosted: load.status === 'Posted',
                isBidding: load.status === 'Bidding'
            }
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Real-time database check endpoint
export const realTimeLoadCheck = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        
        console.log('🔍 Real-time check for shipment:', shipmentNumber);
        
        // Direct database query
        const load = await Load.findOne({ shipmentNumber }).lean();
        
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found in database'
            });
        }

        console.log('🔍 Raw database data:', {
            _id: load._id,
            shipmentNumber: load.shipmentNumber,
            status: load.status,
            statusType: typeof load.status,
            statusLength: load.status ? load.status.length : 0,
            statusBytes: load.status ? Buffer.from(load.status).toString('hex') : 'null',
            updatedAt: load.updatedAt
        });

        // Check if status matches expected values
        const statusChecks = {
            isInTransit: load.status === 'In Transit',
            isInTransitLower: load.status?.toLowerCase() === 'in transit',
            isInTransitTrimmed: load.status?.trim() === 'In Transit',
            isPODUploaded: load.status === 'POD_uploaded',
            isAssigned: load.status === 'Assigned',
            isPosted: load.status === 'Posted'
        };

        res.status(200).json({
            success: true,
            message: 'Real-time database check',
            load: {
                _id: load._id,
                shipmentNumber: load.shipmentNumber,
                status: load.status,
                statusType: typeof load.status,
                statusLength: load.status ? load.status.length : 0,
                updatedAt: load.updatedAt,
                origin: load.origin,
                destination: load.destination,
                assignedTo: load.assignedTo
            },
            statusChecks,
            rawStatus: {
                value: load.status,
                type: typeof load.status,
                length: load.status ? load.status.length : 0,
                hex: load.status ? Buffer.from(load.status).toString('hex') : 'null'
            }
        });
    } catch (error) {
        console.error('❌ Error in realTimeLoadCheck:', error);
        next(error);
    }
};

// Comprehensive debugging endpoint
export const debugLoadStatus = async (req, res, next) => {
    const { shipmentNumber } = req.params;
    
    console.log(`🔍 Debugging load status for shipment: ${shipmentNumber}`);
    
    try {
        // Method 1: Direct database query
        const directLoad = await Load.findOne({ shipmentNumber }).lean();
        console.log('📊 Direct DB Query Result:', directLoad ? {
            _id: directLoad._id,
            status: directLoad.status,
            statusType: typeof directLoad.status,
            statusLength: directLoad.status ? directLoad.status.length : 0
        } : 'Not found');
        
        // Method 2: Mongoose model query
        const mongooseLoad = await Load.findOne({ shipmentNumber });
        console.log('📊 Mongoose Query Result:', mongooseLoad ? {
            _id: mongooseLoad._id,
            status: mongooseLoad.status,
            statusType: typeof mongooseLoad.status,
            statusLength: mongooseLoad.status ? mongooseLoad.status.length : 0
        } : 'Not found');
        
        // Method 3: Check if there are multiple records
        const allLoads = await Load.find({ shipmentNumber }).lean();
        console.log('📊 All matching loads:', allLoads.length);
        
        // Method 4: Check database connection
        const dbState = mongoose.connection.readyState;
        const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
        console.log('📊 Database connection state:', dbStates[dbState]);
        
        // Method 5: Check collection stats
        const collectionStats = await Load.collection.stats();
        console.log('📊 Collection stats:', {
            count: collectionStats.count,
            size: collectionStats.size,
            avgObjSize: collectionStats.avgObjSize
        });
        
        // Method 6: Raw MongoDB query
        const rawLoad = await Load.collection.findOne({ shipmentNumber });
        console.log('📊 Raw MongoDB Query Result:', rawLoad ? {
            _id: rawLoad._id,
            status: rawLoad.status,
            statusType: typeof rawLoad.status,
            statusLength: rawLoad.status ? rawLoad.status.length : 0
        } : 'Not found');
        
        // Method 7: Check for any status updates in recent time
        const recentUpdates = await Load.find({ 
            shipmentNumber,
            updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }).select('status updatedAt').lean();
        console.log('📊 Recent updates:', recentUpdates);
        
        // Method 8: Check if there are any triggers or middleware affecting the data
        console.log('📊 Load model middleware count:', Load.schema.middleware.length);
        
        // Prepare response
        const response = {
            success: true,
            message: "Comprehensive debugging information",
            shipmentNumber,
            databaseConnection: {
                state: dbStates[dbState],
                stateCode: dbState
            },
            collectionInfo: {
                totalDocuments: collectionStats.count,
                collectionSize: collectionStats.size
            },
            queryResults: {
                directQuery: directLoad ? {
                    _id: directLoad._id,
                    status: directLoad.status,
                    statusType: typeof directLoad.status,
                    statusLength: directLoad.status ? directLoad.status.length : 0,
                    updatedAt: directLoad.updatedAt
                } : null,
                mongooseQuery: mongooseLoad ? {
                    _id: mongooseLoad._id,
                    status: mongooseLoad.status,
                    statusType: typeof mongooseLoad.status,
                    statusLength: mongooseLoad.status ? mongooseLoad.status.length : 0,
                    updatedAt: mongooseLoad.updatedAt
                } : null,
                rawMongoQuery: rawLoad ? {
                    _id: rawLoad._id,
                    status: rawLoad.status,
                    statusType: typeof rawLoad.status,
                    statusLength: rawLoad.status ? rawLoad.status.length : 0
                } : null
            },
            matchingRecords: allLoads.length,
            recentUpdates: recentUpdates,
            statusChecks: {
                isInTransit: directLoad ? directLoad.status === 'In Transit' : false,
                isInTransitLower: directLoad ? directLoad.status?.toLowerCase() === 'in transit' : false,
                isInTransitTrimmed: directLoad ? directLoad.status?.trim() === 'In Transit' : false,
                isPODUploaded: directLoad ? directLoad.status === 'POD_uploaded' : false
            }
        };
        
        console.log('📊 Final Response:', JSON.stringify(response, null, 2));
        
        res.status(200).json(response);
        
    } catch (error) {
        console.error('❌ Debug error:', error);
        next(error);
    }
};

// Manual status fix endpoint
export const fixLoadStatus = async (req, res, next) => {
    const { shipmentNumber } = req.params;
    
    console.log(`🔧 Fixing load status for shipment: ${shipmentNumber}`);
    
    try {
        // First, check current status
        const currentLoad = await Load.findOne({ shipmentNumber });
        
        if (!currentLoad) {
            return res.status(404).json({
                success: false,
                message: "Load not found"
            });
        }
        
        console.log('📊 Current status before fix:', currentLoad.status);
        
        // Update status to "In Transit"
        const updatedLoad = await Load.findOneAndUpdate(
            { shipmentNumber },
            { 
                status: "In Transit",
                updatedAt: new Date()
            },
            { new: true }
        );
        
        console.log('📊 Status after fix:', updatedLoad.status);
        
        res.status(200).json({
            success: true,
            message: "Load status fixed to 'In Transit'",
            load: {
                _id: updatedLoad._id,
                shipmentNumber: updatedLoad.shipmentNumber,
                status: updatedLoad.status,
                updatedAt: updatedLoad.updatedAt
            }
        });
        
    } catch (error) {
        console.error('❌ Fix error:', error);
        next(error);
    }
};

// Simple status check endpoint
export const checkLoadStatus = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        
        const load = await Load.findOne({ shipmentNumber });
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }
        
        res.status(200).json({
            success: true,
            load: {
                _id: load._id,
                shipmentNumber: load.shipmentNumber,
                status: load.status,
                statusType: typeof load.status,
                statusLength: load.status ? load.status.length : 0,
                assignedTo: load.assignedTo
            },
            statusChecks: {
                isAssigned: ['Assigned', 'In Transit', 'POD_uploaded'].includes(load.status),
                isInTransit: ['In Transit', 'POD_uploaded'].includes(load.status),
                isPODUploaded: load.status === 'POD_uploaded'
            }
        });
    } catch (error) {
        next(error);
    }
};

// Show all uploaded images for a load
export const showAllImages = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        
        const load = await Load.findOne({ shipmentNumber });
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }
        
        res.status(200).json({
            success: true,
            load: {
                _id: load._id,
                shipmentNumber: load.shipmentNumber,
                status: load.status,
                assignedTo: load.assignedTo,
                origin: load.origin,
                destination: load.destination
            },
            images: {
                pickup: {
                    emptyTruckImages: load.emptyTruckImages?.length || 0,
                    eirTickets: load.eirTickets?.length || 0,
                    containerImages: load.containerImages?.length || 0,
                    sealImages: load.sealImages?.length || 0
                },
                loaded: {
                    loadedTruckImages: load.loadedTruckImages?.length || 0,
                    damageImages: load.damageImages?.length || 0
                },
                delivery: {
                    podImages: load.podImages?.length || 0,
                    proofOfDelivery: load.proofOfDelivery?.length || 0
                }
            },
            notes: load.notes,
            originPlace: load.originPlace,
            destinationPlace: load.destinationPlace
        });
    } catch (error) {
        next(error);
    }
};

// Reset load status for testing
export const resetLoadStatus = async (req, res, next) => {
    try {
        const { shipmentNumber } = req.params;
        const { status = 'In Transit' } = req.body;
        
        const load = await Load.findOne({ shipmentNumber });
        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }
        
        const updatedLoad = await Load.findOneAndUpdate(
            { shipmentNumber },
            { 
                status: status,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        res.status(200).json({
            success: true,
            message: `Load status reset to '${status}'`,
            load: {
                _id: updatedLoad._id,
                shipmentNumber: updatedLoad.shipmentNumber,
                status: updatedLoad.status,
                updatedAt: updatedLoad.updatedAt
            }
        });
    } catch (error) {
        next(error);
    }
};

// ✅ Get all loads for inhouse users
export const getInhouseUserLoads = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            originCity,
            destinationCity,
            vehicleType,
            status,
            loadType,
            minWeight,
            maxWeight,
            minRate,
            maxRate,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};

        // Apply filters
        if (originCity) {
            filter['origin.city'] = { $regex: originCity, $options: 'i' };
        }
        if (destinationCity) {
            filter['destination.city'] = { $regex: destinationCity, $options: 'i' };
        }
        if (vehicleType) {
            filter.vehicleType = vehicleType;
        }
        if (status) {
            filter.status = status;
        }
        if (loadType) {
            filter.loadType = loadType;
        }
        if (minWeight || maxWeight) {
            filter.weight = {};
            if (minWeight) filter.weight.$gte = Number(minWeight);
            if (maxWeight) filter.weight.$lte = Number(maxWeight);
        }
        if (minRate || maxRate) {
            filter.rate = {};
            if (minRate) filter.rate.$gte = Number(minRate);
            if (maxRate) filter.rate.$lte = Number(maxRate);
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const loads = await Load.find(filter)
            .populate('shipper', 'compName mc_dot_no city state email')
            .populate('assignedTo', 'compName mc_dot_no city state')
            .populate('acceptedBid')
            .populate('carrier', 'compName mc_dot_no city state')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Load.countDocuments(filter);

        // Get load statistics
        const stats = await Load.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalLoads: { $sum: 1 },
                    totalPosted: { $sum: { $cond: [{ $eq: ['$status', 'Posted'] }, 1, 0] } },
                    totalBidding: { $sum: { $cond: [{ $eq: ['$status', 'Bidding'] }, 1, 0] } },
                    totalAssigned: { $sum: { $cond: [{ $eq: ['$status', 'Assigned'] }, 1, 0] } },
                    totalInTransit: { $sum: { $cond: [{ $eq: ['$status', 'In Transit'] }, 1, 0] } },
                    totalDelivered: { $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] } },
                    totalCancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } },
                    avgRate: { $avg: '$rate' },
                    totalWeight: { $sum: '$weight' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            loads,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalLoads: total,
            stats: stats[0] || {
                totalLoads: 0,
                totalPosted: 0,
                totalBidding: 0,
                totalAssigned: 0,
                totalInTransit: 0,
                totalDelivered: 0,
                totalCancelled: 0,
                avgRate: 0,
                totalWeight: 0
            }
        });
    } catch (error) {
        console.error('❌ Error in getInhouseUserLoads:', error);
        next(error);
    }
};

// ✅ Get specific load details for inhouse users
export const getInhouseUserLoadDetails = async (req, res, next) => {
    try {
        const { loadId } = req.params;

        if (!loadId) {
            return res.status(400).json({
                success: false,
                message: 'Load ID is required'
            });
        }

        const load = await Load.findById(loadId)
            .populate('shipper', 'compName mc_dot_no city state email phone')
            .populate('assignedTo', 'compName mc_dot_no city state email phone')
            .populate('acceptedBid')
            .populate('carrier', 'compName mc_dot_no city state email phone')
            .exec();

        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found'
            });
        }

        // Get related bids for this load
        const bids = await Bid.find({ load: loadId })
            .populate('trucker', 'compName mc_dot_no city state email phone')
            .sort({ createdAt: -1 })
            .exec();

        // Get tracking information if available
        let tracking = null;
        if (load.shipmentNumber) {
            tracking = await Tracking.findOne({ shipmentNumber: load.shipmentNumber })
                .sort({ createdAt: -1 })
                .exec();
        }

        res.status(200).json({
            success: true,
            load,
            bids,
            tracking,
            totalBids: bids.length
        });
    } catch (error) {
        console.error('❌ Error in getInhouseUserLoadDetails:', error);
        next(error);
    }
};

// ✅ Sales user creates a load for their shipper
export const createLoadBySalesUser = async (req, res, next) => {
    try {
        const {
            fromCity, fromState,
            toCity, toState,
            weight, commodity, vehicleType, pickupDate, deliveryDate, rate, rateType,
            bidDeadline,
            loadType, // 'OTR' or 'DRAYAGE'
            containerNo, poNumber, bolNumber,
            returnDate, returnLocation
        } = req.body;

        // ✅ 1. Check if user is authenticated and is a sales employee
        if (!req.user || !req.user.empId) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not authenticated' 
            });
        }

        // ✅ 2. Check if user belongs to Sales department
        if (req.user.department !== 'Sales') {
            return res.status(403).json({ 
                success: false, 
                message: 'Only Sales department employees can create loads for shippers' 
            });
        }

        // ✅ 3. Validate required fields (same as shipper API)
        if (!loadType || !['OTR', 'DRAYAGE'].includes(loadType)) {
            return res.status(400).json({ 
                success: false, 
                message: 'loadType (OTR or DRAYAGE) is required.' 
            });
        }

        if (loadType === 'DRAYAGE' && (!returnDate || !returnLocation)) {
            return res.status(400).json({ 
                success: false, 
                message: 'returnDate and returnLocation are required for DRAYAGE loads.' 
            });
        }

        // ✅ 4. Get shipper ID from request body (required for sales user)
        const { shipperId } = req.body;
        if (!shipperId) {
            return res.status(400).json({ 
                success: false, 
                message: 'shipperId is required for sales user load creation.' 
            });
        }

        // ✅ 5. Verify that the shipper exists and is approved
        const ShipperDriver = mongoose.model('ShipperDriver');
        const shipper = await ShipperDriver.findById(shipperId);
        
        if (!shipper) {
            return res.status(404).json({ 
                success: false, 
                message: 'Shipper not found' 
            });
        }

        if (shipper.status !== 'approved') {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot create load for unapproved shipper' 
            });
        }

        if (shipper.userType !== 'shipper') {
            return res.status(400).json({ 
                success: false, 
                message: 'Can only create loads for shippers' 
            });
        }

        // ✅ 6. Create the load with same structure as shipper API
        const newLoad = new Load({
            shipper: shipperId,
            createdBySalesUser: {
                empId: req.user.empId,
                empName: req.user.employeeName,
                department: req.user.department
            },
            origin: {
                city: fromCity,
                state: fromState,
            },
            destination: {
                city: toCity,
                state: toState,
            },
            weight,
            commodity,
            vehicleType,
            pickupDate,
            deliveryDate,
            rate,
            rateType,
            bidDeadline,
            loadType,
            containerNo,
            poNumber,
            bolNumber,
            returnDate: loadType === 'DRAYAGE' ? returnDate : null,
            returnLocation: loadType === 'DRAYAGE' ? returnLocation : '',
        });

        await newLoad.save();

        // ✅ 7. Send email notification to all approved truckers (same as shipper API)
        try {
            const truckers = await ShipperDriver.find({ userType: 'trucker', status: 'approved' }, 'email compName');
            const subject = `New Load Posted - ${shipper.compName}`;
            const html = `
                <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                  <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                    <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">🚚 New Load Available</h1>
                    <div style="background: #3498db; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                      <h2 style="margin: 0; font-size: 20px;">${shipper.compName}</h2>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                      <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Load Details</h3>
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
                        <div>
                          <strong style="color: #34495e;">📍 Origin:</strong><br>
                          <span style="color: #7f8c8d;">${fromCity}, ${fromState}</span>
                        </div>
                        <div>
                          <strong style="color: #34495e;">🎯 Destination:</strong><br>
                          <span style="color: #7f8c8d;">${toCity}, ${toState}</span>
                        </div>
                        <div>
                          <strong style="color: #34495e;">📦 Commodity:</strong><br>
                          <span style="color: #7f8c8d;">${commodity}</span>
                        </div>
                        <div>
                          <strong style="color: #34495e;">🚛 Vehicle Type:</strong><br>
                          <span style="color: #7f8c8d;">${vehicleType}</span>
                        </div>
                        <div>
                          <strong style="color: #34495e;">⚖️ Weight:</strong><br>
                          <span style="color: #7f8c8d;">${weight} kg</span>
                        </div>
                        <div>
                          <strong style="color: #34495e;">💰 Rate:</strong><br>
                          <span style="color: #7f8c8d;">$${rate} (${rateType})</span>
                        </div>
                        <div>
                          <strong style="color: #34495e;">📅 Pickup Date:</strong><br>
                          <span style="color: #7f8c8d;">${pickupDate ? new Date(pickupDate).toLocaleDateString() : ''}</span>
                        </div>
                        <div>
                          <strong style="color: #34495e;">📅 Delivery Date:</strong><br>
                          <span style="color: #7f8c8d;">${deliveryDate ? new Date(deliveryDate).toLocaleDateString() : ''}</span>
                        </div>
                        <div>
                          <strong style="color: #34495e;">🏷️ Load Type:</strong><br>
                          <span style="color: #7f8c8d;">${loadType}</span>
                        </div>
                        ${loadType === 'DRAYAGE' ? `
                        <div>
                          <strong style="color: #34495e;">🔄 Return Date:</strong><br>
                          <span style="color: #7f8c8d;">${returnDate ? new Date(returnDate).toLocaleDateString() : ''}</span>
                        </div>
                        <div>
                          <strong style="color: #34495e;">📍 Return Location:</strong><br>
                          <span style="color: #7f8c8d;">${returnLocation}</span>
                        </div>
                        ` : ''}
                      </div>
                    </div>
                    
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                      <p style="margin: 0; color: #27ae60; font-weight: bold;">💡 Ready to place your bid?</p>
                    </div>
                    
                    // <a href="https://vpl.com/load-board" style="background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                    //   🚀 View Load Board
                    // </a>
                    
                    <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                      Login to your VPL account to place your bid and win this load!
                    </p>
                  </div>
                </div>
            `;

            for (const trucker of truckers) {
                await sendEmail({
                    to: trucker.email,
                    subject,
                    html
                });
            }
            console.log(`📧 Notification sent to ${truckers.length} truckers.`);
        } catch (emailError) {
            console.error('❌ Error sending email notifications:', emailError);
        }

        // ✅ 8. Return same response structure as shipper API
        res.status(201).json({
            success: true,
            message: 'Load posted successfully on load board',
            load: newLoad,
        });

    } catch (error) {
        console.error('❌ Error in createLoadBySalesUser:', error);
        next(error);
    }
};

// ✅ Get loads created by sales user
export const getLoadsCreatedBySalesUser = async (req, res, next) => {
    try {
        // ✅ 1. Check if user is authenticated and is a sales employee
        if (!req.user || !req.user.empId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }

        // ✅ 2. Check if user belongs to Sales department
        if (req.user.department !== 'Sales') {
            return res.status(403).json({ 
                success: false, 
                message: 'Only Sales department employees can access this data' 
            });
        }

        const {
            page = 1,
            limit = 10,
            status,
            loadType,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // ✅ 3. Build filter to find loads created by this sales user
        const filter = {
            'createdBySalesUser.empId': req.user.empId
        };

        // Apply additional filters
        if (status) {
            filter.status = status;
        }
        if (loadType) {
            filter.loadType = loadType;
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // ✅ 4. Find loads with populated shipper information
        const loads = await Load.find(filter)
            .populate('shipper', 'compName mc_dot_no city state email phoneNo')
            .populate('assignedTo', 'compName mc_dot_no city state')
            .populate('acceptedBid')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Load.countDocuments(filter);

        // ✅ 5. Get statistics for this sales user
        const totalLoads = await Load.countDocuments({ 'createdBySalesUser.empId': req.user.empId });
        const postedLoads = await Load.countDocuments({ 
            'createdBySalesUser.empId': req.user.empId, 
            status: 'Posted' 
        });
        const assignedLoads = await Load.countDocuments({ 
            'createdBySalesUser.empId': req.user.empId, 
            status: 'Assigned' 
        });
        const deliveredLoads = await Load.countDocuments({ 
            'createdBySalesUser.empId': req.user.empId, 
            status: 'Delivered' 
        });

        res.status(200).json({
            success: true,
            loads,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalLoads: total,
            statistics: {
                totalLoads,
                postedLoads,
                assignedLoads,
                deliveredLoads
            },
            salesUser: {
                empId: req.user.empId,
                empName: req.user.employeeName,
                department: req.user.department
            }
        });

    } catch (error) {
        console.error('❌ Error in getLoadsCreatedBySalesUser:', error);
        next(error);
    }
};