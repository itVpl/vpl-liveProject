import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const shipperDriverSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  userType: {
    type: String,
    enum: ['shipper', 'trucker'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  statusUpdatedBy: {
    type: String,
    default: null
  },
  statusUpdatedAt: {
    type: Date,
    default: null
  },
  statusReason: {
    type: String,
    default: null
  },
  // 🔥 New: Reference to employee who added this shipper/trucker
  addedBy: {
    empId: {
      type: String,
      required: false // Optional for public registrations
    },
    employeeName: {
      type: String,
      required: false
    },
    department: {
      type: String,
      required: false
    }
  },
  compName: String,
  mc_dot_no: String,
  carrierType: String,
  fleetsize: Number,
  compAdd: String,
  country: String,
  state: String,
  city: String,
  zipcode: String,
  phoneNo: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  docUpload: String,
}, { timestamps: true });

const ShipperDriver = mongoose.model('ShipperDriver', shipperDriverSchema);
export default ShipperDriver;
