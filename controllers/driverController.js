import Driver from "../models/driverModel.js";
import ShipperDriver from "../models/shipper_driverModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Load } from "../models/loadModel.js";
import multer from "multer";

// export const registerDriver = async (req, res, next) => {
//     try {
//         const {
//             fullName, mcDot, phone, email, driverLicense, gender,
//             country, state, city, zipCode, fullAddress, password
//         } = req.body;

//         const existing = await Driver.findOne({ email });
//         if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });

//         const hashedPassword = await bcrypt.hash(password, 10);

//         const driver = new Driver({
//             fullName, mcDot, phone, email, driverLicense, gender,
//             country, state, city, zipCode, fullAddress,
//             password: hashedPassword
//         });

//         await driver.save();
//         res.status(201).json({ success: true, message: 'Driver registered successfully', driver });
//     } catch (err) {
//         next(err);
//     }
// };


export const registerDriver = async (req, res, next) => {
    try {
        const {
            fullName, mcDot, phone, email, driverLicense, gender,
            country, state, city, zipCode, fullAddress, password
        } = req.body;

        // Trucker (ShipperDriver with userType='trucker') se truckerId lena
        const trucker = req.user; // Auth middleware se aata hai

        if (!trucker || trucker.userType !== 'trucker') {
            return res.status(403).json({ success: false, message: 'Only truckers can add drivers' });
        }

        const existing = await Driver.findOne({ email });
        if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const driver = new Driver({
            fullName, mcDot, phone, email, driverLicense, gender,
            country, state, city, zipCode, fullAddress,
            password: hashedPassword,
            truckerId: trucker._id  // 💥 Associate driver with trucker
        });

        await driver.save();
        
        // Populate trucker info for response
        const driverWithTrucker = await Driver.findById(driver._id).populate('truckerId', 'compName mc_dot_no');
        
        res.status(201).json({ 
            success: true, 
            message: 'Driver registered successfully', 
            driver: driverWithTrucker 
        });
    } catch (err) {
        next(err);
    }
};


export const loginDriver = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // ✅ 1. Required Field Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
                errors: {
                    email: !email ? 'Email is required' : null,
                    password: !password ? 'Password is required' : null
                }
            });
        }

        // ✅ 2. Email Format Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address',
                errors: {
                    email: 'Invalid email format'
                }
            });
        }

        // ✅ 3. Password Length Validation
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long',
                errors: {
                    password: 'Password must be at least 6 characters'
                }
            });
        }

        // ✅ 4. Email Trim and Lowercase
        const cleanEmail = email.trim().toLowerCase();

        // ✅ 5. Find Driver
        const driver = await Driver.findOne({ email: cleanEmail }).populate('truckerId', 'compName mc_dot_no');
        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found with this email address',
                errors: {
                    email: 'No driver found with this email'
                }
            });
        }

        // ✅ 6. Password Verification
        const isMatch = await bcrypt.compare(password, driver.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password',
                errors: {
                    password: 'Incorrect password'
                }
            });
        }

        // ✅ 7. Generate Token
        console.log('🔍 Debug - Driver ID for JWT:', driver._id);
        const token = jwt.sign({ id: driver._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // ✅ 8. Success Response
        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            driver: {
                id: driver._id,
                fullName: driver.fullName,
                phone: driver.phone,
                email: driver.email,
                vehicle: driver.mcDot,
                truckerCompany: driver.truckerId?.compName || 'Unknown Company',
                mcDot: driver.truckerId?.mc_dot_no || 'N/A'
            }
        });
    } catch (err) {
        console.error('❌ Driver login error:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.',
            errors: {
                general: 'Something went wrong. Please try again.'
            }
        });
    }
};

// ✅ Get all drivers (for admin/super admin)
export const getAllDrivers = async (req, res, next) => {
    try {
        const drivers = await Driver.find()
            .populate('truckerId', 'compName mc_dot_no userType')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, drivers });
    } catch (err) {
        next(err);
    }
};

// ✅ Get drivers by trucker (for trucker to see their drivers)
export const getDriversByTrucker = async (req, res, next) => {
    try {
        const trucker = req.user;
        
        if (!trucker || trucker.userType !== 'trucker') {
            return res.status(403).json({ success: false, message: 'Only truckers can view their drivers' });
        }

        const drivers = await Driver.find({ truckerId: trucker._id })
            .select('-password')
            .sort({ createdAt: -1 });
            
        res.status(200).json({ 
            success: true, 
            truckerCompany: trucker.compName,
            totalDrivers: drivers.length,
            drivers 
        });
    } catch (err) {
        next(err);
    }
};

// ✅ Get Single Driver with trucker info
export const getDriverById = async (req, res, next) => {
    try {
        const driver = await Driver.findById(req.params.id)
            .populate('truckerId', 'compName mc_dot_no userType');
            
        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
        
        res.status(200).json({ success: true, driver });
    } catch (err) {
        next(err);
    }
};

// ✅ Update Driver (only trucker can update their own drivers)
export const updateDriver = async (req, res, next) => {
    try {
        const trucker = req.user;
        const driverId = req.params.id;
        
        // Check if driver belongs to this trucker
        const driver = await Driver.findById(driverId);
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }
        
        if (driver.truckerId.toString() !== trucker._id.toString()) {
            return res.status(403).json({ success: false, message: 'You can only update your own drivers' });
        }
        
        const updated = await Driver.findByIdAndUpdate(driverId, req.body, { new: true })
            .populate('truckerId', 'compName mc_dot_no');
            
        res.status(200).json({ success: true, driver: updated });
    } catch (err) {
        next(err);
    }
};

// ✅ Delete Driver (only trucker can delete their own drivers)
export const deleteDriver = async (req, res, next) => {
    try {
        const trucker = req.user;
        const driverId = req.params.id;
        
        // Check if driver belongs to this trucker
        const driver = await Driver.findById(driverId);
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }
        
        if (driver.truckerId.toString() !== trucker._id.toString()) {
            return res.status(403).json({ success: false, message: 'You can only delete your own drivers' });
        }
        
        const deleted = await Driver.findByIdAndDelete(driverId);
        res.status(200).json({ success: true, message: 'Driver deleted successfully' });
    } catch (err) {
        next(err);
    }
};

// ✅ Get shipments assigned to the logged-in driver
export const getAssignedShipments = async (req, res, next) => {
    try {
        const driverId = req.user._id;
        const allAssignedLoads = await Load.find({ assignedTo: driverId })
            .populate('shipper', 'compName')
            .populate('acceptedBid')
            .sort({ pickupDate: 1 });

        // Split into active and inactive
        const activeShipments = allAssignedLoads.filter(load => load.status === 'Assigned' || load.status === 'In Transit');
        const inactiveShipments = allAssignedLoads.filter(load => load.status === 'Delivered');

        res.status(200).json({
            success: true,
            activeShipments,
            inactiveShipments
        });
    } catch (err) {
        next(err);
    }
};

// ✅ Mark arrival at origin and upload images
export const markArrivalAndUpload = async (req, res, next) => {
    try {
        const { loadId } = req.params;
        const { type, location, notes, arrivalType } = req.body; // 'empty', 'loaded', 'pod', 'teir', 'origin', 'destination'
        const files = req.files || [];

        const load = await Load.findById(loadId);
        if (!load) return res.status(404).json({ success: false, message: 'Load not found' });

        // Only assigned driver can mark
        if (!load.assignedTo || load.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Validate arrival type
        if (!arrivalType || !['origin', 'destination'].includes(arrivalType)) {
            return res.status(400).json({ success: false, message: 'Arrival type must be origin or destination' });
        }

        // Mark arrival based on type
        if (arrivalType === 'origin') {
            if (!load.originPlace) load.originPlace = {};
            load.originPlace.status = 1;
            load.originPlace.arrivedAt = new Date();
            load.originPlace.notes = notes || '';
            load.originPlace.location = location || '';
            
            // Update load status to 'In Transit' when arriving at origin
            if (load.status === 'Assigned') {
                load.status = 'In Transit';
            }
        } else if (arrivalType === 'destination') {
            if (!load.destinationPlace) load.destinationPlace = {};
            load.destinationPlace.status = 1;
            load.destinationPlace.arrivedAt = new Date();
            load.destinationPlace.notes = notes || '';
            load.destinationPlace.location = location || '';
            
            // Update load status to 'Delivered' when arriving at destination
            load.status = 'Delivered';
        }

        // Save images as per type
        if (load.loadType === 'OTR') {
            if (type === 'empty') load.emptyTruckImages.push(...files.map(f => f.path));
            if (type === 'loaded') load.loadedTruckImages.push(...files.map(f => f.path));
            if (type === 'pod') load.podImages.push(...files.map(f => f.path));
        } else if (load.loadType === 'DRAYAGE' && type === 'teir') {
            load.teirTickets.push(...files.map(f => f.path));
        }

        // Update tracking status
        const Tracking = (await import('../models/Tracking.js')).default;
        const tracking = await Tracking.findOne({ load: load._id });
        if (tracking) {
            if (arrivalType === 'origin') {
                tracking.status = 'in_transit';
            } else if (arrivalType === 'destination') {
                tracking.status = 'delivered';
                tracking.endedAt = new Date();
            }
            await tracking.save();
        }

        await load.save();
        
        res.status(200).json({ 
            success: true, 
            message: `Arrival marked at ${arrivalType} and images uploaded`, 
            load,
            arrivalType,
            timestamp: new Date()
        });
    } catch (err) {
        next(err);
    }
};

// ✅ Get arrival history for a specific load
export const getArrivalHistory = async (req, res, next) => {
    try {
        const { loadId } = req.params;
        
        const load = await Load.findById(loadId);
        if (!load) return res.status(404).json({ success: false, message: 'Load not found' });

        // Only assigned driver can view
        if (!load.assignedTo || load.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const arrivalHistory = {
            origin: load.originPlace || {},
            destination: load.destinationPlace || {},
            images: {
                emptyTruck: load.emptyTruckImages || [],
                loadedTruck: load.loadedTruckImages || [],
                pod: load.podImages || [],
                teirTickets: load.teirTickets || []
            },
            loadStatus: load.status,
            loadType: load.loadType
        };

        res.status(200).json({ 
            success: true, 
            arrivalHistory,
            loadId 
        });
    } catch (err) {
        next(err);
    }
};

// ✅ Update arrival status (for corrections)
export const updateArrivalStatus = async (req, res, next) => {
    try {
        const { loadId } = req.params;
        const { arrivalType, status, notes } = req.body; // arrivalType: 'origin' or 'destination'

        const load = await Load.findById(loadId);
        if (!load) return res.status(404).json({ success: false, message: 'Load not found' });

        // Only assigned driver can update
        if (!load.assignedTo || load.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (arrivalType === 'origin') {
            if (!load.originPlace) load.originPlace = {};
            load.originPlace.status = status;
            load.originPlace.notes = notes || load.originPlace.notes;
        } else if (arrivalType === 'destination') {
            if (!load.destinationPlace) load.destinationPlace = {};
            load.destinationPlace.status = status;
            load.destinationPlace.notes = notes || load.destinationPlace.notes;
        } else {
            return res.status(400).json({ success: false, message: 'Invalid arrival type' });
        }

        await load.save();
        
        res.status(200).json({ 
            success: true, 
            message: `${arrivalType} arrival status updated`,
            load 
        });
    } catch (err) {
        next(err);
    }
};

// ✅ Get all arrival records for driver
export const getAllArrivalRecords = async (req, res, next) => {
    try {
        const driverId = req.user._id;
        
        const loads = await Load.find({ assignedTo: driverId })
            .select('originPlace destinationPlace status loadType shipmentNumber origin destination createdAt')
            .populate('shipper', 'compName')
            .sort({ createdAt: -1 });

        const arrivalRecords = loads.map(load => ({
            loadId: load._id,
            shipmentNumber: load.shipmentNumber,
            shipper: load.shipper?.compName,
            loadType: load.loadType,
            status: load.status,
            origin: {
                address: `${load.origin.city}, ${load.origin.state}`,
                arrival: load.originPlace || {}
            },
            destination: {
                address: `${load.destination.city}, ${load.destination.state}`,
                arrival: load.destinationPlace || {}
            },
            createdAt: load.createdAt
        }));

        res.status(200).json({ 
            success: true, 
            totalRecords: arrivalRecords.length,
            arrivalRecords 
        });
    } catch (err) {
        next(err);
    }
};

// ✅ Get logged-in driver's profile
export const getMyProfile = async (req, res, next) => {
    try {
        // Only allow if user is a driver (not trucker or shipper)
        // Driver model has no userType, so check if req.user is instance of Driver
        if (!req.user || req.user.constructor.modelName !== 'Driver') {
            return res.status(403).json({ success: false, message: 'Only drivers can access this route' });
        }
        // Remove password from response
        const { password, ...driverData } = req.user.toObject();
        res.status(200).json({ success: true, driver: driverData });
    } catch (err) {
        next(err);
    }
};

// ✅ Get driver details by ID (public route)
export const getDriverDetailsById = async (req, res, next) => {
    try {
        const { driverId } = req.params;
        
        const driver = await Driver.findById(driverId)
            .populate('truckerId', 'compName mc_dot_no')
            .select('-password');
            
        if (!driver) {
            return res.status(404).json({ 
                success: false, 
                message: 'Driver not found with this ID' 
            });
        }
        
        res.status(200).json({ 
            success: true, 
            driver 
        });
    } catch (err) {
        next(err);
    }
};