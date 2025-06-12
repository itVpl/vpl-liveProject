import ShipperDriver from '../models/shipper_driverModel.js';
import hashPassword from '../utils/hashPassword.js';

const registerUser = async (req, res) => {
    try {
        const {
            userType, compName, mc_dot_no, carrierType, fleetsize,
            compAdd, country, state, city, zipcode, phoneNo, email, password
        } = req.body;

        if (!userType || !phoneNo || !email || !password) {
            return res.status(400).json({ message: 'Required fields missing' });
        }

        const existingUser = await ShipperDriver.findOne({ $or: [{ email }, { phoneNo }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Email or Phone already registered' });
        }

        const hashedPassword = await hashPassword(password);
        const docUploadPath = req.file ? `uploads/docs/${req.file.filename}` : '';

        const newUser = new ShipperDriver({
            userType,
            compName,
            mc_dot_no,
            carrierType,
            fleetsize,
            compAdd,
            country,
            state,
            city,
            zipcode,
            phoneNo,
            email,
            password: hashedPassword,
            docUpload: docUploadPath,
        });

        await newUser.save();
        res.status(201).json({ message: 'User registered successfully', userId: newUser.userId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await ShipperDriver.find().select('-password'); // hide password
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const getAllShippers = async (req, res) => {
    try {
        const shippers = await ShipperDriver.find({ userType: 'shipper' }).select('-password');
        res.status(200).json({ success: true, data: shippers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const getAllTruckers = async (req, res) => {
    try {
        const truckers = await ShipperDriver.find({ userType: 'driver' }).select('-password');
        res.status(200).json({ success: true, data: truckers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

export { registerUser, getAllUsers, getAllShippers, getAllTruckers }; // ✅ ES module named export
