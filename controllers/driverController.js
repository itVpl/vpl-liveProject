import Driver from "../models/driverModel.js";
import ShipperDriver from "../models/shipper_driverModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Load } from "../models/loadModel.js";

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