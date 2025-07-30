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
    enum: ['pending', 'accountant_approved', 'approved', 'rejected'],
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
  // 🔥 NEW: Approval history for tracking approval flow
  approvalHistory: [{
    step: {
      type: String,
      enum: ['accountant_approval', 'manager_approval', 'accountant_rejection', 'manager_rejection']
    },
    status: {
      type: String,
      enum: ['approved', 'rejected']
    },
    approvedBy: String,
    approvedByName: String,
    approvedAt: Date,
    rejectedBy: String,
    rejectedByName: String,
    rejectedAt: Date,
    reason: String
  }],
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
  agentIds: [{ type: String }],
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
  // 🔥 NEW: Additional document uploads for CMT users
  documents: {
    brokeragePacket: String,
    carrierPartnerAgreement: String,
    w9Form: String,
    mcAuthority: String,
    safetyLetter: String,
    bankingInfo: String,
    inspectionLetter: String,
    insurance: String
  }
}, { timestamps: true });

const ShipperDriver = mongoose.model('ShipperDriver', shipperDriverSchema);
export default ShipperDriver;
