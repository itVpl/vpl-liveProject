import mongoose from "mongoose";

const bidSchema = new mongoose.Schema({
    load: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Load',
        required: true,
    },
    carrier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ShipperDriver',
        required: true,
    },
    rate: {
        type: Number,
        required: true,
    },
    message: {
        type: String,
        default: '',
    },
    estimatedPickupDate: {
        type: Date,
        required: true,
    },
    estimatedDeliveryDate: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['PendingApproval', 'Pending', 'Accepted', 'Rejected'],
        default: 'PendingApproval',
    },
    intermediateRate: {
        type: Number,
        default: null,
    },
    rejectionReason: {
        type: String,
        default: '',
    },
    acceptedAt: {
        type: Date,
        default: null,
    },
    rejectedAt: {
        type: Date,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    driverName: {
        type: String,
        default: '',
    },
    driverPhone: {
        type: String,
        default: '',
    },
    vehicleNumber: {
        type: String,
        default: '',
    },
    vehicleType: {
        type: String,
        default: '',
    },
    doDocument: {
        type: String,
        default: '',
    },
    opsApproved: {
        type: Boolean,
        default: false,
    },
    opsApprovedAt: {
        type: Date,
        default: null,
    },
    placedByInhouseUser: {
        type: String,
        default: null,
    },
    approvedByinhouseUser: {
        empId: { type: String },
        empName: { type: String },
        dept: { type: String }
    },
    
    // ✅ NEW: Track who accepted/rejected the bid by inhouse user
    acceptedByInhouseUser: {
        empId: { type: String },
        empName: { type: String },
        dept: { type: String }
    },
    rejectedByInhouseUser: {
        empId: { type: String },
        empName: { type: String },
        dept: { type: String }
    },
    
    intermediateApprovedAt: {
        type: Date,
        default: null,
    },
});

// Update the updatedAt field before saving
bidSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Index for better query performance
bidSchema.index({ load: 1, carrier: 1 });
bidSchema.index({ carrier: 1, status: 1 });
bidSchema.index({ load: 1, status: 1 });

const Bid = mongoose.model("Bid", bidSchema);
export default Bid;