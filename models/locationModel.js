import mongoose from "mongoose";

const locationHistorySchema = new mongoose.Schema({
  // 🔗 Reference to tracking record
  trackingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tracking',
    required: true,
    index: true
  },
  
  // 🚛 Vehicle and shipment details
  vehicleNumber: {
    type: String,
    required: true,
    index: true
  },
  shipmentNumber: {
    type: String,
    required: true,
    index: true
  },
  
  // 📍 Location coordinates
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  
  // 📍 Additional location data
  locationData: {
    accuracy: { type: Number }, // GPS accuracy in meters
    altitude: { type: Number }, // Altitude if available
    speed: { type: Number }, // Speed in km/h
    heading: { type: Number }, // Direction in degrees
    address: { type: String }, // Reverse geocoded address
    city: { type: String },
    state: { type: String },
    country: { type: String }
  },
  
  // 📱 Device and app information
  deviceInfo: {
    deviceId: { type: String },
    deviceModel: { type: String },
    appVersion: { type: String },
    batteryLevel: { type: Number }, // Battery percentage
    networkType: { type: String }, // WiFi, 4G, 3G etc.
    signalStrength: { type: Number } // Signal strength
  },
  
  // 🕐 Timestamp
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // 📊 Trip progress
  tripProgress: {
    distanceFromOrigin: { type: Number }, // Distance from origin in km
    distanceToDestination: { type: Number }, // Distance to destination in km
    estimatedTimeToDestination: { type: Number }, // ETA in minutes
    progressPercentage: { type: Number } // Progress percentage (0-100)
  },
  
  // 🏷️ Status and metadata
  status: {
    type: String,
    enum: ['active', 'stopped', 'offline', 'error'],
    default: 'active'
  },
  
  // 📝 Additional notes
  notes: { type: String },
  
  // 🔄 Sync status
  syncedToServer: {
    type: Boolean,
    default: true
  },
  
  // 📍 Location quality indicators
  locationQuality: {
    isAccurate: { type: Boolean, default: true },
    confidence: { type: Number, default: 1.0 }, // 0.0 to 1.0
    source: { type: String, enum: ['gps', 'network', 'manual'], default: 'gps' }
  }
}, { 
  timestamps: true,
  strict: false // Allow flexible fields
});

// 🔍 Indexes for better query performance
locationHistorySchema.index({ trackingId: 1, timestamp: -1 });
locationHistorySchema.index({ vehicleNumber: 1, timestamp: -1 });
locationHistorySchema.index({ shipmentNumber: 1, timestamp: -1 });
locationHistorySchema.index({ 'locationData.city': 1, timestamp: -1 });
locationHistorySchema.index({ status: 1, timestamp: -1 });

// 📊 Virtual for formatted timestamp
locationHistorySchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// 📊 Virtual for distance calculation
locationHistorySchema.virtual('distanceFromPrevious').get(function() {
  // This would be calculated when needed
  return 0;
});

// 🔄 Pre-save middleware to add metadata
locationHistorySchema.pre('save', function(next) {
  // Auto-calculate progress if not provided
  if (!this.tripProgress.progressPercentage && this.tripProgress.distanceFromOrigin && this.tripProgress.distanceToDestination) {
    const totalDistance = this.tripProgress.distanceFromOrigin + this.tripProgress.distanceToDestination;
    if (totalDistance > 0) {
      this.tripProgress.progressPercentage = Math.round((this.tripProgress.distanceFromOrigin / totalDistance) * 100);
    }
  }
  
  // Set location quality based on accuracy
  if (this.locationData.accuracy) {
    this.locationQuality.isAccurate = this.locationData.accuracy <= 10; // 10 meters or less is accurate
    this.locationQuality.confidence = Math.max(0, 1 - (this.locationData.accuracy / 100)); // Higher accuracy = higher confidence
  }
  
  next();
});

// 📊 Static method to get location history for a tracking
locationHistorySchema.statics.getLocationHistory = async function(trackingId, options = {}) {
  const {
    startDate,
    endDate,
    limit = 1000,
    skip = 0,
    sort = { timestamp: -1 }
  } = options;
  
  const query = { trackingId };
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  return await this.find(query)
    .sort(sort)
    .limit(limit)
    .skip(skip)
    .lean();
};

// 📊 Static method to get latest location for a tracking
locationHistorySchema.statics.getLatestLocation = async function(trackingId) {
  return await this.findOne({ trackingId })
    .sort({ timestamp: -1 })
    .lean();
};

// 📊 Static method to get location statistics
locationHistorySchema.statics.getLocationStats = async function(trackingId) {
  const locations = await this.find({ trackingId }).sort({ timestamp: 1 });
  
  if (locations.length === 0) {
    return {
      totalPoints: 0,
      totalDistance: 0,
      averageSpeed: 0,
      duration: 0,
      startTime: null,
      endTime: null
    };
  }
  
  let totalDistance = 0;
  let totalSpeed = 0;
  let speedCount = 0;
  
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];
    
    // Calculate distance between points (Haversine formula)
    const distance = calculateDistance(
      prev.latitude, prev.longitude,
      curr.latitude, curr.longitude
    );
    totalDistance += distance;
    
    // Calculate speed if time difference is available
    const timeDiff = (curr.timestamp - prev.timestamp) / 1000 / 3600; // hours
    if (timeDiff > 0 && curr.locationData.speed) {
      totalSpeed += curr.locationData.speed;
      speedCount++;
    }
  }
  
  const duration = (locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000 / 3600; // hours
  
  return {
    totalPoints: locations.length,
    totalDistance: Math.round(totalDistance * 100) / 100, // Round to 2 decimal places
    averageSpeed: speedCount > 0 ? Math.round(totalSpeed / speedCount) : 0,
    duration: Math.round(duration * 100) / 100,
    startTime: locations[0].timestamp,
    endTime: locations[locations.length - 1].timestamp
  };
};

// 🧮 Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export const LocationHistory = mongoose.model("LocationHistory", locationHistorySchema, "location_history");

// 🔄 Legacy location model (for backward compatibility)
const locationSchema = new mongoose.Schema({
  vehicleNo: {
    type: String,
    required: true,
    index: true,
  },
  // Add other fields as per your collection structure
}, { strict: false }); // Allow flexible fields

export const Location = mongoose.model("Location", locationSchema, "locations"); 