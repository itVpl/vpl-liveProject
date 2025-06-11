import Driver from "../models/driverModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const registerDriver = async (req, res, next) => {
    try {
        const {
            fullName, mcDot, phone, email, driverLicense, gender,
            country, state, city, zipCode, fullAddress, password
        } = req.body;

        const existing = await Driver.findOne({ email });
        if (existing) return res.status(400).json({ message: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const driver = new Driver({
            fullName, mcDot, phone, email, driverLicense, gender,
            country, state, city, zipCode, fullAddress,
            password: hashedPassword
        });

        await driver.save();
        res.status(201).json({ message: 'Driver registered successfully', driver });
    } catch (err) {
        next(err);
    }
};

export const loginDriver = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const driver = await Driver.findOne({ email });
        if (!driver) return res.status(404).json({ message: 'Driver not found' });

        const isMatch = await bcrypt.compare(password, driver.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: driver._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: 'Login successful',
            token,
            driver: {
                id: driver._id,
                fullName: driver.fullName,
                phone: driver.phone,
                email: driver.email,
                vehicle: driver.mcDot
            }
        });
    } catch (err) {
        next(err);
    }
};


export const getAllDrivers = async (req, res, next) => {
    try {
        const drivers = await Driver.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, drivers });
    } catch (err) {
        next(err);
    }
};

// ✅ Get Single Driver
export const getDriverById = async (req, res, next) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (!driver) return res.status(404).json({ message: 'Driver not found' });
        res.status(200).json({ success: true, driver });
    } catch (err) {
        next(err);
    }
};

// ✅ Update Driver
export const updateDriver = async (req, res, next) => {
    try {
        const updated = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ message: 'Driver not found' });
        res.status(200).json({ success: true, driver: updated });
    } catch (err) {
        next(err);
    }
};

// ✅ Delete Driver
export const deleteDriver = async (req, res, next) => {
    try {
        const deleted = await Driver.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Driver not found' });
        res.status(200).json({ success: true, message: 'Driver deleted successfully' });
    } catch (err) {
        next(err);
    }
};