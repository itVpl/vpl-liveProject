import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  empId: { type: String, required: true, unique: true },

  employeeName: { type: String, required: true },
  aliasName: { type: String },
  sex: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  email: { type: String, required: true, unique: true },
  mobileNo: { type: String, required: true },
  alternateNo: { type: String },
  emergencyNo: { type: String },

  department: { type: String, required: true },
  designation: { type: String, required: true },
  dateOfJoining: { type: Date, required: true },

  identityDocs: {
    panCard: { type: String },
    aadharCard: { type: String },
    educationalDocs: [{ type: String }]
  },

  previousCompanyDocs: {
    releaseLetter: { type: String },
    offerLetter: { type: String },
    experienceLetter: { type: String },
    bankStatementOrSalarySlip: [{ type: String }]
  },

  bankDetails: {
    accountHolderName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String }
  },

  password: { type: String, required: true, select: false },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },

  // 🔐 Role-based access
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'employee'],
    default: 'employee'
  },
  docVerified: {
    type: Boolean,
    default: false
  },
  // allowedModules: [{ type: String }]
  allowedModules: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ModuleMaster'
  }],

  // 📅 Leave Balance Tracking
  leaveBalance: {
    casual: { type: Number, default: 12 }, // 12 casual leaves per year
    sick: { type: Number, default: 15 },   // 15 sick leaves per year
    earned: { type: Number, default: 0 },  // Earned leaves (accrued)
    total: { type: Number, default: 27 }   // Total available leaves
  },
  
  // 📊 Leave Year Configuration
  leaveYear: {
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true }
  }

}, { timestamps: true });


const Employee = mongoose.model('Employee', employeeSchema);
export { Employee };