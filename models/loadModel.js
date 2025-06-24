import mongoose from 'mongoose';

const loadSchema = new mongoose.Schema({
  shipper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShipperDriver',
    required: true,
  },
  origin: {
    city: { type: String, required: true },
    state: { type: String, required: true },
  },
  destination: {
    city: { type: String, required: true },
    state: { type: String, required: true },
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
    enum: ['Posted', 'Bidding', 'Assigned', 'In Transit', 'Delivered', 'Cancelled'],
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
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
loadSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export const Load = mongoose.model('Load', loadSchema);
