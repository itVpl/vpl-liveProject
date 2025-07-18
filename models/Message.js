import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  message: { type: String },
  image: { type: String }, // URL or path to image
  file: { type: String },  // URL or path to file (image, pdf, etc.)
  status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent' },
  timestamp: { type: Date, default: Date.now },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null }
});

export default mongoose.model('Message', messageSchema); 

