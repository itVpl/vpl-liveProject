import mongoose from 'mongoose';

const trackingSchema = new mongoose.Schema({
  load: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Load',
    required: true,
    unique: true,
  },
  originLatLng: {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
  },
  destinationLatLng: {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
  },
  currentLocation: {
    lat: { type: Number },
    lon: { type: Number },
    updatedAt: { type: Date },
  },
  status: {
    type: String,
    enum: ['in_transit', 'delivered', 'pending'],
    default: 'pending',
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
  },
  vehicleNumber: {
    type: String,
    default: '',
  },
  shipmentNumber: {
    type: String,
    default: '',
  },
  originName: { type: String, default: '' },
  destinationName: { type: String, default: '' },
  loadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Load', default: null },
  shipperName: { type: String, default: '' },
  truckerName: { type: String, default: '' },
  bidId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid', default: null },
  driverName: { type: String, default: '' },
});

export default mongoose.model('Tracking', trackingSchema); 