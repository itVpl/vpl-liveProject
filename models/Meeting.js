import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InhouseUser',
    required: true,
  },
  meetingDate: {
    type: Date,
    required: true,
  },
  meetingTime: {
    type: String, // e.g. '14:00' (24hr format)
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Meeting', meetingSchema); 