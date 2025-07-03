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
    const allEmployees = await Employee.find({}, 'empId employeeName department role');
    const empMap = {};
    allEmployees.forEach(emp => {
      empMap[emp.empId] = {
        name: emp.employeeName,
        department: emp.department,
        role: emp.role
      };
    });
    // Get all activities for the day
    const records = await UserActivity.find(filter).sort({ empId: 1 }).lean();
    // Group by empId
    const grouped = {};
    records.forEach(r => {
      if (!grouped[r.empId]) grouped[r.empId] = [];
      grouped[r.empId].push(r);
    });
    const enriched = allEmployees.map(emp => {
      const sessions = grouped[emp.empId] || [];
      let totalHours = 0;
      let firstLogin = null;
      let lastLogout = null;
      sessions.forEach(s => {
        if (s.loginTime && s.logoutTime) {
          const hours = (new Date(s.logoutTime) - new Date(s.loginTime)) / (1000 * 60 * 60);
          totalHours += hours;
          if (!firstLogin || new Date(s.loginTime) < new Date(firstLogin)) firstLogin = s.loginTime;
          if (!lastLogout || new Date(s.logoutTime) > new Date(lastLogout)) lastLogout = s.logoutTime;
        }
      });
      let status = 'absent';
      if (sessions.length > 0) {
        if (totalHours >= 8) status = 'present';
        else if (totalHours > 0) status = 'half day';
      }
      return {
        date: formatDateOnly(d),
        empId: emp.empId,
        empName: emp.employeeName,
        department: emp.department,
        role: emp.role,
        loginTime: firstLogin ? formatDate(firstLogin) : '-',
        logoutTime: lastLogout ? formatDate(lastLogout) : '-',
        totalTime: formatDuration(totalHours),
        status
      };
    });
    res.status(200).json({ success: true, date, total: enriched.length, records: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


export const getAttendanceByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    const allEmployees = await Employee.find({}, 'empId employeeName department role');
    const empMap = {};
    allEmployees.forEach(emp => {
      empMap[emp.empId] = {
        name: emp.employeeName,
        department: emp.department,
        role: emp.role
      };
    });
    // Get all activities in range
    const records = await UserActivity.find({ date: { $gte: start, $lte: end } }).sort({ empId: 1, date: 1 }).lean();
    // Group by empId and date
    const grouped = {};
    records.forEach(r => {
      const key = r.empId + '_' + formatDateOnly(r.date);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d.getTime())); // clone date to avoid mutation bug
    }
    const enriched = [];
    allEmployees.forEach(emp => {
      days.forEach(day => {
        const key = emp.empId + '_' + formatDateOnly(day);
        const sessions = grouped[key] || [];
        let totalHours = 0;
        let firstLogin = null;
        let lastLogout = null;
        sessions.forEach(s => {
          if (s.loginTime && s.logoutTime) {
            const hours = (new Date(s.logoutTime) - new Date(s.loginTime)) / (1000 * 60 * 60);
            totalHours += hours;
            if (!firstLogin || new Date(s.loginTime) < new Date(firstLogin)) firstLogin = s.loginTime;
            if (!lastLogout || new Date(s.logoutTime) > new Date(lastLogout)) lastLogout = s.logoutTime;
          }
        });
        let status = 'absent';
        if (sessions.length > 0) {
          if (totalHours >= 8) status = 'present';
          else if (totalHours > 0) status = 'half day';
        }
        enriched.push({
          date: formatDateOnly(day),
          empId: emp.empId,
          empName: emp.employeeName,
          department: emp.department,
          role: emp.role,
          loginTime: firstLogin ? formatDate(firstLogin) : '-',
          logoutTime: lastLogout ? formatDate(lastLogout) : '-',
          totalTime: formatDuration(totalHours),
          status
        });
      });
    });
    res.status(200).json({ success: true, total: enriched.length, records: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Helper functions
const formatDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-').replace(',', '');
};

const formatDateOnly = (d) => {
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
};

// Helper to format total time as HH:mm:ss
function formatDuration(hoursFloat) {
  const totalSeconds = Math.round(hoursFloat * 3600);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

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


export const getMyAttendance = async (req, res) => {
  try {
    const empId = req.user.empId;
    const { month, date } = req.query; // month: YYYY-MM, date: YYYY-MM-DD

    if (date) {
      // Single day attendance
      const d = new Date(date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      const records = await UserActivity.find({
        empId,
        date: { $gte: start, $lte: end }
      }).lean();
      let totalHours = 0;
      let firstLogin = null;
      let lastLogout = null;
      const sessions = records
        .filter(s => s.loginTime && s.logoutTime)
        .map(s => {
          const durationHrs = (new Date(s.logoutTime) - new Date(s.loginTime)) / (1000 * 60 * 60);
          return {
            loginTime: formatDate(s.loginTime),
            logoutTime: formatDate(s.logoutTime),
            duration: formatDuration(durationHrs)
          };
        });
      records.forEach(s => {
        if (s.loginTime && s.logoutTime) {
          const hours = (new Date(s.logoutTime) - new Date(s.loginTime)) / (1000 * 60 * 60);
          totalHours += hours;
          if (!firstLogin || new Date(s.loginTime) < new Date(firstLogin)) firstLogin = s.loginTime;
          if (!lastLogout || new Date(s.logoutTime) > new Date(lastLogout)) lastLogout = s.logoutTime;
        }
      });
      let status = 'absent';
      if (records.length > 0) {
        if (totalHours >= 8) status = 'present';
        else if (totalHours > 0) status = 'half day';
      }
      return res.status(200).json({
        success: true,
        empId,
        date: formatDateOnly(new Date(date)),
        loginTime: firstLogin ? formatDate(firstLogin) : '-',
        logoutTime: lastLogout ? formatDate(lastLogout) : '-',
        totalTime: formatDuration(totalHours),
        status,
        sessions
      });
    }
    if (!month) {
      return res.status(400).json({ success: false, message: 'Month is required in YYYY-MM format' });
    }
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(`${month}-31T23:59:59Z`);
    const records = await UserActivity.find({
      empId,
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 }).lean();
    // Group by date
    const grouped = {};
    records.forEach(r => {
      const key = formatDateOnly(r.date);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d.getTime())); // clone date to avoid mutation bug
    }
    const enriched = days.map(day => {
      const key = formatDateOnly(day);
      const sessions = grouped[key] || [];
      let totalHours = 0;
      let firstLogin = null;
      let lastLogout = null;
      sessions.forEach(s => {
        if (s.loginTime && s.logoutTime) {
          const hours = (new Date(s.logoutTime) - new Date(s.loginTime)) / (1000 * 60 * 60);
          totalHours += hours;
          if (!firstLogin || new Date(s.loginTime) < new Date(firstLogin)) firstLogin = s.loginTime;
          if (!lastLogout || new Date(s.logoutTime) > new Date(lastLogout)) lastLogout = s.logoutTime;
        }
      });
      let status = 'absent';
      if (sessions.length > 0) {
        if (totalHours >= 8) status = 'present';
        else if (totalHours > 0) status = 'half day';
      }
      return {
        date: formatDateOnly(day),
        loginTime: firstLogin ? formatDate(firstLogin) : '-',
        logoutTime: lastLogout ? formatDate(lastLogout) : '-',
        totalTime: formatDuration(totalHours),
        status
      };
    });
    res.status(200).json({ success: true, empId, month, records: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};