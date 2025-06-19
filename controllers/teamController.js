import { Employee } from '../models/inhouseUserModel.js';

export const getTeamMembers = async (req, res) => {
  try {
    const { role, department } = req.user;

    if (role !== 'admin' && role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Only Admins and Superadmins allowed.' });
    }

    let filter = { role: 'employee' };

    // If not superadmin, filter only their own department
    if (role === 'admin') {
      filter.department = department;
    }

    const members = await Employee.find(filter, '-password');

    res.status(200).json({
      success: true,
      department: role === 'superadmin' ? 'All Departments' : department,
      totalMembers: members.length,
      team: members
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
