import { Load } from '../models/loadModel.js';
import Bid from '../models/bidModel.js';
import mongoose from 'mongoose';
import ShipperDriver from '../models/shipper_driverModel.js';
import { sendEmail } from '../utils/sendEmail.js';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import Tracking from '../models/Tracking.js';
import { proofOfDeliveryUpload } from '../middlewares/upload.js';

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

        const newLoad = new Load({
            shipper: req.user._id,
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
        // Debug: Check user object
        console.log('🔍 Debug - Full req.user object:', req.user);
        console.log('🔍 Debug - User ID type:', typeof req.user?._id);
        console.log('🔍 Debug - User ID value:', req.user?._id);
        
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
    // Move files to shipment number folder if available
    const fs = (await import('fs')).default;
    const path = (await import('path')).default;
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const proofOfDeliveryBasePath = path.join(__dirname, '../uploads/proofOfDelivery');
    const shipmentFolder = path.join(proofOfDeliveryBasePath, load.shipmentNumber || load._id.toString());
    if (!fs.existsSync(shipmentFolder)) {
      fs.mkdirSync(shipmentFolder, { recursive: true });
    }
    // Move uploaded files to shipment folder
    const fileUrls = [];
    for (const file of req.files) {
      const destPath = path.join(shipmentFolder, path.basename(file.path));
      fs.renameSync(file.path, destPath);
      fileUrls.push('/uploads/proofOfDelivery/' + (load.shipmentNumber || load._id.toString()) + '/' + path.basename(file.path));
    }
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
