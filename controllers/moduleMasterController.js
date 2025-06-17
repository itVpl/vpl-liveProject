import { ModuleMaster } from '../models/moduleMasterModel.js';

// 🔹 Add new module
export const addModule = async (req, res) => {
    try {
        const { name, label, icon } = req.body;

        // ✅ Check for duplicate
        const existing = await ModuleMaster.findOne({ name });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Module already exists' });
        }

        const newModule = await ModuleMaster.create({ name, label, icon });
        res.status(201).json({ success: true, module: newModule });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 🔹 Get all modules
// export const getAllModules = async (req, res) => {
//     try {
//         const includeAll = req.query.all === 'true';
//         const filter = includeAll ? {} : { isActive: true };
//         const modules = await ModuleMaster.find(filter);
//         res.status(200).json({ success: true, modules });
//     } catch (err) {
//         res.status(500).json({ success: false, message: err.message });
//     }
// };

export const getAllModules = async (req, res) => {
    try {
        // Superadmin ko sab module dikhenge — no filter
        const modules = await ModuleMaster.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, modules });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// deactivate module
export const deactivateModule = async (req, res) => {
    const { id } = req.params;
    try {
        const module = await ModuleMaster.findByIdAndUpdate(id, { isActive: false }, { new: true });
        if (!module) {
            return res.status(404).json({ success: false, message: 'Module not found' });
        }
        res.status(200).json({ success: true, message: 'Module deactivated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
