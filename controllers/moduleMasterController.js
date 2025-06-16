import { ModuleMaster } from '../models/moduleMasterModel.js';

// 🔹 Add new module
export const addModule = async (req, res) => {
  try {
    const { name, label, icon } = req.body;
    const newModule = await ModuleMaster.create({ name, label, icon });
    res.status(201).json({ success: true, module: newModule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get all modules
export const getAllModules = async (req, res) => {
  try {
    const modules = await ModuleMaster.find({ isActive: true });
    res.status(200).json({ success: true, modules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
