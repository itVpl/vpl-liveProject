import DO from '../models/doModel.js';

// Create a new DO (Order)
export const createDO = async (req, res) => {
  try {
    const doData = req.body;
    const newDO = await DO.create(doData);
    res.status(201).json({ success: true, data: newDO });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get DOs by Employee ID
export const getDOByEmpId = async (req, res) => {
  try {
    const { empId } = req.params;
    const dos = await DO.find({ empId: empId });
    res.status(200).json({ success: true, data: dos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all DOs
export const getAllDO = async (req, res) => {
  try {
    const dos = await DO.find();
    res.status(200).json({ success: true, data: dos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get DOs by date (YYYY-MM-DD)
export const getDOByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required in query params.' });
    }
    const start = new Date(date);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    const dos = await DO.find({ date: { $gte: start, $lte: end } });
    res.status(200).json({ success: true, data: dos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get DOs by date range (startDate, endDate as YYYY-MM-DD)
export const getDOByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required in query params.' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const dos = await DO.find({ date: { $gte: start, $lte: end } });
    res.status(200).json({ success: true, data: dos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}; 