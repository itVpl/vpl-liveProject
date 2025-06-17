import mongoose from 'mongoose';
const targetSchema = new mongoose.Schema({
    empId: { type: String, required: true },         // Employee target assigned to
    title: { type: String, required: true },          // eg. "Make 20 Calls"
    description: { type: String },                   // Optional detail
    date: { type: Date, required: true },            // Target date
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    assignedBy: { type: String, required: true }     // Admin empId
}, { timestamps: true });

export const Target = mongoose.model("dailyEmployeeTarget", targetSchema);