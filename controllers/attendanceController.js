import { UserActivity } from '../models/userActivityModel.js';
import { Employee } from '../models/inhouseUserModel.js';
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

    const records = await UserActivity.find(filter).sort({ empId: 1 }).lean();
    const allEmployees = await Employee.find({}, 'empId employeeName department');

    const empMap = {};
    allEmployees.forEach(emp => {
      empMap[emp.empId] = {
        name: emp.employeeName,
        department: emp.department
      };
    });

    const enriched = records.map(r => {
      const totalHours = r.totalHours || 0;
      let status = "absent";

      if (r.loginTime && r.logoutTime) {
        status = totalHours >= 8 ? "present" : "half day";
      }

      return {
        date,
        empId: r.empId,
        empName: empMap[r.empId]?.name || '',
        department: empMap[r.empId]?.department || '',
        loginTime: r.loginTime ? formatDate(r.loginTime) : '-',
        logoutTime: r.logoutTime ? formatDate(r.logoutTime) : '-',
        status
      };
    });

    res.status(200).json({ success: true, date, total: enriched.length, records: enriched });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Helper function
const formatDate = (d) => {
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
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
