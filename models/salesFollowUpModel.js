import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema({
  customerName: { 
    type: String, 
    required: [true, "Customer name is required"],
    trim: true 
  },
  address: { 
    type: String, 
    required: [true, "Address is required"],
    trim: true 
  },
  phone: { 
    type: String, 
    required: [true, "Phone number is required"],
    trim: true 
  },
  contactPerson: { 
    type: String, 
    required: [true, "Contact person is required"],
    trim: true 
  },
  concernedPerson: { 
    type: String, 
    trim: true 
  },
  email: { 
    type: String, 
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  remarks: { 
    type: String, 
    trim: true 
  },
  callingDate: { 
    type: Date, 
    required: [true, "Calling date is required"],
    default: Date.now 
  },
  followUps: [{
    followUpDate: { 
      type: Date, 
      required: true,
      default: Date.now 
    },
    followUpType: { 
      type: String, 
      enum: ['Call', 'Email', 'Meeting', 'WhatsApp', 'Visit', 'Other'],
      required: true 
    },
    followUpNotes: { 
      type: String, 
      required: true,
      trim: true 
    },
    nextFollowUpDate: { 
      type: Date 
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: { 
    type: String, 
    enum: ['New', 'In Progress', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost', 'On Hold'],
    default: 'New',
    required: true 
  },
  creditCheck: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected', 'Not Required'],
    default: 'Pending' 
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }
}, { 
  timestamps: true 
});

// Index for better query performance
followUpSchema.index({ customerName: 1, status: 1 });
followUpSchema.index({ callingDate: 1 });
followUpSchema.index({ email: 1 }); // Index for email queries

const SalesFollowUp = mongoose.model('SalesFollowUp', followUpSchema);
export { SalesFollowUp }; 