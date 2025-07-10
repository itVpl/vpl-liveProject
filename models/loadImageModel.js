import mongoose from 'mongoose';

const loadImageSchema = new mongoose.Schema({
  loadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Load',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true
  },
  vehicleEmptyImg: [{ type: String }],
  vehicleLoadedImg: [{ type: String }],
  POD: [{ type: String }],
  EIRticketImg: [{ type: String }],
  Seal: [{ type: String }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const LoadImage = mongoose.model('LoadImage', loadImageSchema);
export default LoadImage;
