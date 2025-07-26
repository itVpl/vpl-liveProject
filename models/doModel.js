import mongoose from 'mongoose';

const doSchema = new mongoose.Schema({
  empId: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  orderValue: {
    type: Number,
    required: true
  },
  orderDetails: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
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
  }
});

export default mongoose.model('DO', doSchema); 