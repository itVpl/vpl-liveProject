import mongoose from 'mongoose';

const hrActivitySchema = new mongoose.Schema({
  // 👤 HR Employee who made the call
  hrEmployee: {
    empId: { type: String, required: true },
    employeeName: { type: String, required: true },
    department: { type: String, default: 'HR' }
  },

  // 📞 Call Details
  callDetails: {
    mobileNo: { type: String, required: true },
    name: { type: String, required: true },
    purpose: { type: String, required: true },
    callDuration: { type: Number, default: 0 }, // in minutes
    callDate: { type: Date, default: Date.now },
    callTime: { type: String }, // Time of call (e.g., "14:30")
    callStatus: { 
      type: String, 
      enum: ['completed', 'missed', 'no_answer', 'busy'],
      default: 'completed'
    }
  },

  // 📝 Additional Notes
  notes: { type: String },
  
  // 🏷️ Call Category/Tags
  category: { 
    type: String, 
    enum: ['recruitment', 'employee_issue', 'policy_clarification', 'general_inquiry', 'other'],
    default: 'other'
  },

  // 📊 Call Outcome
  outcome: {
    type: String,
    enum: ['positive', 'negative', 'neutral', 'follow_up_required'],
    default: 'neutral'
  },

  // 🔄 Follow-up Required
  followUpRequired: { type: Boolean, default: false },
  followUpDate: { type: Date },
  followUpNotes: { type: String },

  // 📍 Location/Context
  location: { type: String }, // e.g., "Office", "Remote", "Field Visit"
  
  // 🔐 Status
  status: { 
    type: String, 
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },

  // 👥 Related Employee (if call is about specific employee)
  relatedEmployee: {
    empId: { type: String },
    employeeName: { type: String },
    department: { type: String }
  }

}, { 
  timestamps: true 
});

// 📊 Virtual for call duration in hours
hrActivitySchema.virtual('callDurationHours').get(function() {
  return this.callDetails.callDuration / 60;
});

// 📊 Virtual for formatted call duration
hrActivitySchema.virtual('formattedCallDuration').get(function() {
  const minutes = this.callDetails.callDuration;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes}m`;
});

// 📊 Index for efficient queries
hrActivitySchema.index({ 'hrEmployee.empId': 1, 'callDetails.callDate': -1 });
hrActivitySchema.index({ 'callDetails.callDate': 1 });
hrActivitySchema.index({ 'callDetails.mobileNo': 1 });

const HRActivity = mongoose.model('HRActivity', hrActivitySchema);
export { HRActivity }; 