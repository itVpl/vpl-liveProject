import mongoose from 'mongoose';

const userActivitySchema = new mongoose.Schema({
    empId: {
        type: String,
        required: true,
        ref: 'Employee'
    },
    date: {
        type: Date,
        required: true
    },
    loginTime: {
        type: Date,
        required: true
    },
    logoutTime: {
        type: Date
    },
    totalHours: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'short', 'absent', 'onLeave'], // 🔁 Add remaining statuses
        default: 'active'
    }
}, { timestamps: true });

// Create index for faster queries
userActivitySchema.index({ empId: 1, date: 1 });

const UserActivity = mongoose.model('UserActivity', userActivitySchema);
export { UserActivity }; 