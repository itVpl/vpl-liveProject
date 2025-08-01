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
    required: true
  },
  fsc: {
    type: Number,
    required: true
  },
  other: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  }
});

const carrierSchema = new mongoose.Schema({
  carrierName: {
    type: String,
    required: true
  },
  equipmentType: {
    type: String,
    required: true
  },
  carrierFees: {
    type: Number,
    required: true
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
  remarks: {
    type: String
  },
  supportingDocs: {
    type: String
  },
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
  next();
});

export default mongoose.model('DO', doSchema); 