import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  loadNo: {
    type: String,
    required: true
  },
  billTo: {
    type: String,
    required: true
  },
  dispatcherName: {
    type: String,
    required: true
  },
  workOrderNo: {
    type: String,
    required: true
  },
  lineHaul: {
    type: Number,
    required: true,
    set: function(val) {
      return Number(val) || 0;
    }
  },
  fsc: {
    type: Number,
    required: true,
    set: function(val) {
      return Number(val) || 0;
    }
  },
  other: {
    type: Number,
    required: true,
    set: function(val) {
      return Number(val) || 0;
    }
  },
  totalAmount: {
    type: Number,
    required: true
  }
});

// Virtual for calculated total amount
customerSchema.virtual('calculatedTotal').get(function() {
  const lineHaul = Number(this.lineHaul) || 0;
  const fsc = Number(this.fsc) || 0;
  const other = Number(this.other) || 0;
  return lineHaul + fsc + other;
});

// Include virtuals when converting to JSON
customerSchema.set('toJSON', { virtuals: true });
customerSchema.set('toObject', { virtuals: true });

const carrierSchema = new mongoose.Schema({
  carrierName: {
    type: String,
    required: true
  },
  equipmentType: {
    type: String,
    required: true
  },
  carrierFees: [{
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    total: {
      type: Number,
      required: true
    }
  }],
  totalCarrierFees: {
    type: Number,
    default: 0
  }
});

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  zipCode: {
    type: String,
    required: true
  }
});

const shipperSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  pickUpLocations: [locationSchema],
  pickUpDate: {
    type: Date,
    required: true
  },
  containerNo: {
    type: String,
    required: true
  },
  containerType: {
    type: String,
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  dropLocations: [locationSchema],
  dropDate: {
    type: Date,
    required: true
  }
});

const doSchema = new mongoose.Schema({
  empId: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  customers: [customerSchema],
  carrier: carrierSchema,
  shipper: shipperSchema,
  createdBySalesUser: {
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
      default: 'Sales'
    }
  },
  // 🔥 NEW: Assignment to CMT user
  assignedToCMT: {
    empId: {
      type: String,
      required: false
    },
    employeeName: {
      type: String,
      required: false
    },
    department: {
      type: String,
      default: 'CMT'
    },
    assignedAt: {
      type: Date,
      default: null
    },
    assignedBy: {
      empId: {
        type: String,
        required: false
      },
      employeeName: {
        type: String,
        required: false
      },
      department: {
        type: String,
        default: 'Sales'
      }
    }
  },
  // 🔥 NEW: Assignment status
  assignmentStatus: {
    type: String,
    enum: ['unassigned', 'assigned', 'in_progress', 'completed'],
    default: 'unassigned'
  },
  remarks: {
    type: String
  },
  supportingDocs: {
    type: String
  },
  uploadedFiles: [{
    fileName: {
      type: String,
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      required: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
doSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate totalAmount for each customer
  if (this.customers && Array.isArray(this.customers)) {
    for (const customer of this.customers) {
      if (customer.lineHaul !== undefined && customer.fsc !== undefined && customer.other !== undefined) {
        const lineHaul = Number(customer.lineHaul);
        const fsc = Number(customer.fsc);
        const other = Number(customer.other);
        customer.totalAmount = lineHaul + fsc + other;
      }
    }
  }
  
  // Ensure totalCarrierFees is calculated correctly
  if (this.carrier && this.carrier.carrierFees && Array.isArray(this.carrier.carrierFees)) {
    let totalCarrierFees = 0;
    for (const fee of this.carrier.carrierFees) {
      if (fee.quantity && fee.amount) {
        const quantity = Number(fee.quantity);
        const amount = Number(fee.amount);
        totalCarrierFees += quantity * amount;
      }
    }
    this.carrier.totalCarrierFees = totalCarrierFees;
  }
  
  next();
});

// Pre-update middleware to handle totalAmount calculation
doSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Handle totalAmount calculation for customers in updates
  if (update.customers && Array.isArray(update.customers)) {
    for (const customer of update.customers) {
      if (customer.lineHaul !== undefined && customer.fsc !== undefined && customer.other !== undefined) {
        const lineHaul = Number(customer.lineHaul);
        const fsc = Number(customer.fsc);
        const other = Number(customer.other);
        customer.totalAmount = lineHaul + fsc + other;
      }
    }
  }
  
  // Handle carrier fees calculation in updates
  if (update.carrier && update.carrier.carrierFees && Array.isArray(update.carrier.carrierFees)) {
    let totalCarrierFees = 0;
    for (const fee of update.carrier.carrierFees) {
      if (fee.quantity && fee.amount) {
        const quantity = Number(fee.quantity);
        const amount = Number(fee.amount);
        totalCarrierFees += quantity * amount;
      }
    }
    update.carrier.totalCarrierFees = totalCarrierFees;
  }
  
  next();
});

export default mongoose.model('DO', doSchema); 