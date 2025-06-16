import BreakLog from '../models/BreakLog.js';
import moment from 'moment';

const breakDurations = { Dinner: 30, Bio: 5, Smoking: 5 };

export const startBreak = async (req, res) => {
  try {
    // Get empId from authenticated user
    const empId = req.user.empId;
    const { breakType } = req.body;

    // Check if user already has an ongoing break
    const ongoingBreak = await BreakLog.findOne({ empId, endTime: null });
    if (ongoingBreak) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already have an ongoing break. Please end it first.' 
      });
    }

    const startTime = new Date();
    const date = moment().format('YYYY-MM-DD');

    await BreakLog.create({ empId, breakType, startTime, date });
    res.status(200).json({ 
      success: true, 
      message: `${breakType} break started.`,
      startTime: formatDate(startTime)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const endBreak = async (req, res) => {
  try {
    // Get empId from authenticated user
    const empId = req.user.empId;
    const ongoingBreak = await BreakLog.findOne({ empId, endTime: null }).sort({ startTime: -1 });

    if (!ongoingBreak) {
      return res.status(404).json({ 
        success: false, 
        message: 'No ongoing break found.' 
      });
    }

    const endTime = new Date();
    const durationMinutes = Math.floor((endTime - ongoingBreak.startTime) / 60000);

    // Check if break duration exceeds limit
    const maxDuration = breakDurations[ongoingBreak.breakType];
    if (durationMinutes > maxDuration) {
      ongoingBreak.overdue = true;
    }

    ongoingBreak.endTime = endTime;
    ongoingBreak.durationMinutes = durationMinutes;
    await ongoingBreak.save();

    res.status(200).json({ 
      success: true, 
      message: `${ongoingBreak.breakType} break ended.`,
      duration: `${durationMinutes} minutes`,
      endTime: formatDate(endTime)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper function to format date
const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

export const checkOverdueBreaks = async () => {
  const now = new Date();
  const ongoingBreaks = await BreakLog.find({ endTime: null, overdue: false });

  for (const br of ongoingBreaks) {
    const maxDuration = breakDurations[br.breakType];
    const minutesPassed = Math.floor((now - br.startTime) / 60000);

    if (minutesPassed > maxDuration) {
      br.overdue = true;
      await br.save();

      // In future: Notify employee or manager here
      console.log(`Employee ${br.empId} exceeded ${br.breakType} break`);
    }
  }
};
