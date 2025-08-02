import mongoose from 'mongoose';

const hrActivitySchema = new mongoose.Schema({
  // 👤 HR Employee who made the activity
  hrEmployee: {
    empId: { type: String, required: true },
    employeeName: { type: String, required: true },
    department: { type: String, default: 'HR' }
  },

  // 📞 Activity Type (call or email)
  activityType: {
    type: String,
    enum: ['call', 'email'],
    required: true
  },

  // 📞 Call Details (only for call activities)
  callDetails: {
    name: { type: String },
    mobileNo: { type: String },
    totalExp: { type: String },
    currentLocation: { type: String },
    currentCompany: { type: String },
    currentSalary: { type: String },
    noticePeriod: { type: String },
    email: { type: String },
    comment: { type: String },
    purpose: { type: String },
    duration: { type: Number, default: 0 } // in minutes
  },

  // 📧 Email Details (only for email activities)
  emailDetails: {
    email: { type: String },
    emailType: { 
      type: String, 
      enum: ['send', 'reply'],
      default: 'send'
    },
    purpose: { type: String }
  },

  // 📅 Activity Date (only date, no time)
  activityDate: { 
    type: Date, 
    required: true,
    default: Date.now,
    get: function(date) {
      return date ? date.toISOString().split('T')[0] : null;
    },
    set: function(dateString) {
      if (typeof dateString === 'string') {
        const date = new Date(dateString);
        date.setHours(0, 0, 0, 0);
        return date;
      }
      return dateString;
    }
  },

  // 📝 Additional Notes
  notes: { type: String },

  // 🔐 Status
  status: { 
    type: String, 
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },

  // 🎨 Color for HR marking/categorization
  color: {
    type: String,
    enum: ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'black', 'white'],
    default: 'blue',
    required: false
  }

}, { 
  timestamps: true 
});

// Custom validation for required fields based on activity type
hrActivitySchema.pre('save', function(next) {
  if (this.activityType === 'call') {
    if (!this.callDetails || !this.callDetails.mobileNo || !this.callDetails.name || !this.callDetails.purpose) {
      return next(new Error('For call activities: mobileNo, name, and purpose are required'));
    }
  } else if (this.activityType === 'email') {
    if (!this.emailDetails || !this.emailDetails.email || !this.emailDetails.purpose) {
      return next(new Error('For email activities: email and purpose are required'));
    }
  }
  next();
});

// 📊 Virtual for call duration in hours
hrActivitySchema.virtual('callDurationHours').get(function() {
  return this.callDetails?.duration / 60 || 0;
});

// 📊 Virtual for formatted call duration
hrActivitySchema.virtual('formattedCallDuration').get(function() {
  const minutes = this.callDetails?.duration || 0;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes}m`;
});

// 📊 Index for efficient queries
hrActivitySchema.index({ 'hrEmployee.empId': 1, 'activityDate': -1 });
hrActivitySchema.index({ 'activityDate': 1 });
hrActivitySchema.index({ 'activityType': 1 });

const HRActivity = mongoose.model('HRActivity', hrActivitySchema);
export { HRActivity }; 