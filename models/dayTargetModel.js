import mongoose from 'mongoose';

const dayTargetSchema = new mongoose.Schema({
  empId: { 
    type: String, 
    required: true 
  },
  employeeName: { 
    type: String, 
    required: true 
  },
  department: { 
    type: String, 
    required: true,
    enum: ['sales', 'cmt', 'hr', 'admin', 'finance', 'operations']
  },
  date: { 
    type: Date, 
    required: true,
    default: Date.now 
  },
  
  // Sales Department Targets
  salesTargets: {
    dailyCalls: { 
      type: Number, 
      default: 0 
    },
    talkTimeHours: { 
      type: Number, 
      default: 0 
    },
    rateRequests: { 
      type: Number, 
      default: 0 
    },
    deliveryOrders: { 
      type: Number, 
      default: 0 
    },
    completedCalls: { 
      type: Number, 
      default: 0 
    },
    completedTalkTime: { 
      type: Number, 
      default: 0 
    },
    completedRateRequests: { 
      type: Number, 
      default: 0 
    },
    completedDeliveryOrders: { 
      type: Number, 
      default: 0 
    }
  },
  
  // CMT Department Targets
  cmtTargets: {
    trackingCompanies: { 
      type: Number, 
      default: 0 
    },
    completedTrackingCompanies: { 
      type: Number, 
      default: 0 
    }
  },
  
  // General Status
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'overdue'], 
    default: 'pending' 
  },
  
  // Progress tracking
  progress: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 100 
  },
  
  // Notes/Comments
  notes: { 
    type: String 
  },
  
  // Assigned by (admin/superadmin)
  assignedBy: { 
    type: String, 
    required: true 
  },
  
  // Completion tracking
  completedAt: { 
    type: Date 
  },
  
  // Daily reset flag
  isDailyTarget: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true 
});

// Index for efficient queries
dayTargetSchema.index({ empId: 1, date: 1 });
dayTargetSchema.index({ department: 1, date: 1 });

// Virtual for calculating progress based on department
dayTargetSchema.virtual('calculatedProgress').get(function() {
  if (this.department === 'sales') {
    // Calculate progress for sales with flexible completion logic
    const callTarget = this.salesTargets.dailyCalls;
    const rateRequestTarget = this.salesTargets.rateRequests;
    const deliveryOrderTarget = this.salesTargets.deliveryOrders;
    
    const completedCalls = this.salesTargets.completedCalls;
    const completedRateRequests = this.salesTargets.completedRateRequests;
    const completedDeliveryOrders = this.salesTargets.completedDeliveryOrders;
    
    // Primary target: 100 calls + 2 rate requests
    const primaryTarget = callTarget + rateRequestTarget;
    const primaryCompleted = completedCalls + completedRateRequests;
    
    // Alternative target: 2 delivery orders (if calls not achieved)
    const alternativeTarget = deliveryOrderTarget;
    const alternativeCompleted = completedDeliveryOrders;
    
    // Calculate progress based on which target is more achievable
    let progress = 0;
    
    if (primaryCompleted >= primaryTarget) {
      // Primary target achieved
      progress = 100;
    } else if (alternativeCompleted >= alternativeTarget) {
      // Alternative target achieved
      progress = 100;
    } else {
      // Calculate partial progress
      const primaryProgress = primaryCompleted / primaryTarget;
      const alternativeProgress = alternativeCompleted / alternativeTarget;
      progress = Math.max(primaryProgress, alternativeProgress) * 100;
    }
    
    return Math.round(progress);
  } else if (this.department === 'cmt') {
    return this.cmtTargets.trackingCompanies > 0 ? 
      Math.round((this.cmtTargets.completedTrackingCompanies / this.cmtTargets.trackingCompanies) * 100) : 0;
  }
  return 0;
});

// Pre-save middleware to update progress
dayTargetSchema.pre('save', function(next) {
  this.progress = this.calculatedProgress;
  
  // Update status based on progress
  if (this.progress >= 100) {
    this.status = 'completed';
    this.completedAt = new Date();
  } else if (this.progress > 0) {
    this.status = 'in_progress';
  }
  
  next();
});

export const DayTarget = mongoose.model("DayTarget", dayTargetSchema); 