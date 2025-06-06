import mongoose from "mongoose";

const locationSchema = new mongoose.Schema({
  vehicleNo: {
    type: String,
    required: true,
    index: true,
  },
  // Add other fields as per your collection structure
}, { strict: false }); // Allow flexible fields

export const Location = mongoose.model("Location", locationSchema, "locations"); 