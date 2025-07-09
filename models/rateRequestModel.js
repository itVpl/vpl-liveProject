import mongoose from 'mongoose';

const rateRequestSchema = new mongoose.Schema({
  empId: { 
    type: String, 
    required: true 
  },
  date: { 
    type: String, 
    required: true 
  }, // Format: YYYY-MM-DD
  requestNumber: { 
    type: Number, 
    required: true 
  }, // 1, 2, 3, etc.
  description: { 
    type: String, 
    default: '' 
  },
  completed: { 
    type: Boolean, 
    default: false 
  },
  completedAt: { 
    type: Date 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Compound index to ensure unique rate requests per employee per day
rateRequestSchema.index({ empId: 1, date: 1, requestNumber: 1 }, { unique: true });

export default mongoose.model('RateRequest', rateRequestSchema); 