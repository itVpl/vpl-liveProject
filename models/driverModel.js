import mongoose from "mongoose";

const driverSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    mcDot: { type: String },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    driverLicense: { type: String, required: true, unique: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    zipCode: { type: String, required: true },
    fullAddress: { type: String, required: true },
    password: { type: String, required: true }, // hashed
    truckerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShipperDriver', required: true }, // 🔥 new
    createdAt: { type: Date, default: Date.now }
  });

const Driver = mongoose.model('Driver', driverSchema);
export default Driver;