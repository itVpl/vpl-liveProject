import { Target } from '../models/targetModel.js';

// 🎯 Assign new target
export const assignTarget = async (req, res) => {
    try {
        const { empId, title, description, date } = req.body;
        const assignedBy = req.user.empId; // From auth middleware

        const newTarget = await Target.create({
            empId,
            title,
            description,
            date,
            assignedBy
        });

        res.status(201).json({ success: true, target: newTarget });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 📋 Get targets by employee
export const getTargetsByEmployee = async (req, res) => {
    try {
        const { empId } = req.params;
        const targets = await Target.find({ empId }).sort({ date: -1 });
        res.status(200).json({ success: true, targets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ✅ Mark target as completed
export const updateTargetStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const updated = await Target.findByIdAndUpdate(id, { status }, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: "Target not found" });

        res.status(200).json({ success: true, target: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};