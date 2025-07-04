import mongoose from 'mongoose';

const loadSchema = new mongoose.Schema({
  shipper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShipperDriver',
    required: false,
    default: null,
  },
  origin: {
    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: false },
    zip: { type: String },
  },
  destination: {
    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: false },
    zip: { type: String },
  },
  weight: {
    type: Number,
    required: true,
  },
  commodity: {
    type: String,
    required: true,
  },
  vehicleType: {
    type: String,
    enum: ['Truck', 'Trailer', 'Container', 'Reefer', 'Flatbed', 'Tanker', 'Box Truck', 'Power Only'],
    required: true,
  },
  // Load board specific fields
  pickupDate: {
    type: Date,
    required: true,
  },
  deliveryDate: {
    type: Date,
    required: true,
  },
  rate: {
    type: Number,
    required: true,
  },
  rateType: {
    type: String,
    enum: ['Per Mile', 'Flat Rate', 'Per Hundred Weight'],
    default: 'Flat Rate',
  },  
  status: {
    type: String,
    enum: ['Posted', 'Bidding', 'Assigned', 'In Transit', 'POD_uploaded', 'PendingVerification', 'Delivered', 'Cancelled'],
    default: 'Posted',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShipperDriver',
    default: null,
  },
  acceptedBid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bid',
    default: null,
  },
  bidDeadline: {
    type: Date,
    default: null,
  },
  shipmentNumber: {
    type: String,
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
  loadType: {
    type: String,
    enum: ['OTR', 'DRAYAGE'],
    required: true,
  },
  containerNo: {
    type: String,
    default: '',
  },
  poNumber: {
    type: String,
    default: '',
  },
  bolNumber: {
    type: String,
    default: '',
  },
  returnDate: {
    type: Date,
    default: null,
  },
  returnLocation: {
    type: String,
    default: '',
  },
  proofOfDelivery: [{ type: String }], // URLs of images uploaded by driver
  // Delivery approval by shipper
  deliveryApproval: { type: Boolean, default: false },
});

// Update the updatedAt field before saving
loadSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.loadType === 'DRAYAGE') {
    if (!this.returnDate || !this.returnLocation) {
      return next(new Error('returnDate and returnLocation are required for DRAYAGE loads.'));
    }
  }
  next();
});

export const Load = mongoose.model('Load', loadSchema);
