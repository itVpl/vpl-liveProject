import mongoose from 'mongoose';

const targetReasonSchema = new mongoose.Schema({
  empId: { 
    type: String, 
    required: true 
  },
  
  date: { 
    type: Date, 
    required: true 
  },
  
  reason: { 
    type: String, 
    required: true,
    minlength: 10,
    maxlength: 500
  },
  
  submittedBy: { 
    type: String, 
    required: true 
  },
  
  submittedAt: { 
    type: Date, 
    default: Date.now 
  }

}, { timestamps: true });

// Index for efficient queries
targetReasonSchema.index({ empId: 1, date: 1 }, { unique: true });

const TargetReason = mongoose.model('TargetReason', targetReasonSchema);
export { TargetReason }; 