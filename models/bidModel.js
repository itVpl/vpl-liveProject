import mongoose from "mongoose";

const bidSchema = new mongoose.Schema({
    load: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Load',
        required: true,
    },
    carrier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true,
    },
    rate: {
        type: Number,
        required: true,
    },
    message: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['Pending', 'Accepted', 'Rejected'],
        default: 'Pending',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
})

const Bid = mongoose.model("Bid", bidSchema);
export default Bid;