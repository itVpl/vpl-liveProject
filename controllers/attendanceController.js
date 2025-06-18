import { UserActivity } from '../models/userActivityModel.js';
import { startOfDay, endOfDay } from 'date-fns';

// 🔹 Get All Attendance
// export const getAllAttendance = async (req, res) => {
//   try {
//     const { date } = req.query;
//     let filter = {};

//     if (date) {
//       const d = new Date(date);
//       filter.date = {
//         $gte: startOfDay(d),
//         $lte: endOfDay(d)
//       };
//     }

//     const records = await UserActivity.find(filter).sort({ date: -1 });
//     res.status(200).json({ success: true, records });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };


export const getAllAttendance = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const d = new Date(date);
    const filter = {
      date: {
        $gte: startOfDay(d),
        $lte: endOfDay(d)
      }
    };

    const records = await UserActivity.find(filter).sort({ empId: 1 });

    res.status(200).json({ success: true, date, total: records.length, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Get Attendance by empId
export const getEmployeeAttendance = async (req, res) => {
  try {
    const { empId } = req.params;
    const records = await UserActivity.find({ empId }).sort({ date: -1 });
    res.status(200).json({ success: true, empId, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Auto-mark absentees
export const markAbsentEmployees = async (req, res) => {
  try {
    const allEmpIds = req.body.allEmpIds || [];
    const today = new Date();
    const dateStart = startOfDay(today);
    const dateEnd = endOfDay(today);

    const alreadyMarked = await UserActivity.find({
      date: { $gte: dateStart, $lte: dateEnd },
    });

    const markedEmpIds = alreadyMarked.map(r => r.empId);
    const absentEmpIds = allEmpIds.filter(id => !markedEmpIds.includes(id));

    const bulkData = absentEmpIds.map(empId => ({
      empId,
      date: dateStart,
      status: 'absent'
    }));

    await UserActivity.insertMany(bulkData);

    res.status(200).json({
      success: true,
      message: `${bulkData.length} employees marked absent`,
      absentEmpIds
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
