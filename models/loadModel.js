// import mongoose from 'mongoose';

// const addressSchema = new mongoose.Schema({
//     organization: { type: String, required: true },
//     plotNo: { type: String, required: true },
//     street: { type: String, required: true },
//     zip: { type: String, required: true },
//     landmark: { type: String },
//     city: { type: String, required: true },
//   });

//   const loadSchema = new mongoose.Schema({
//     shipper: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//     origin: {
//       type: addressSchema,
//       required: true,
//     },
//     destination: {
//       type: addressSchema,
//       required: true,
//     },
//     weight: {
//       type: Number,
//       required: true,
//     },
//     vehicleType: {
//       type: String,
//       required: true,
//     },
//     rate: {
//       type: Number,
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ['Posted', 'Assigned', 'Delivered'],
//       default: 'Posted',
//     },
//     createdAt: {
//       type: Date,
//       default: Date.now,
//     },
//   });
  
//   export const Load = mongoose.model('Load', loadSchema);




import mongoose from 'mongoose';

const loadSchema = new mongoose.Schema({
  shipper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  origin: {
    city: { type: String, required: true }
  },
  destination: {
    city: { type: String, required: true }
  },
  weight: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['Posted', 'Assigned', 'Delivered'],
    default: 'Posted',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Load = mongoose.model('Load', loadSchema);
