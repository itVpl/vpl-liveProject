import { HRActivity } from '../models/hrActivityModel.js';
import { Employee } from '../models/inhouseUserModel.js';
import moment from 'moment-timezone';

// 📞 POST: Create new HR call activity
export const createHRActivity = async (req, res) => {
  try {
    const {
      mobileNo,
      name,
      purpose,
      callDuration = 0,
      callDate,
      callTime,
      callStatus = 'completed',
      notes,
      category = 'other',
      outcome = 'neutral',
      followUpRequired = false,
      followUpDate,
      followUpNotes,
      location,
      relatedEmployeeEmpId,
      relatedEmployeeName,
      relatedEmployeeDepartment
    } = req.body;

    // Validate required fields
    if (!mobileNo || !name || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number, name, and purpose are required'
      });
    }

    // Get HR employee details from authenticated user
    const hrEmployee = {
      empId: req.user.empId,
      employeeName: req.user.employeeName,
      department: req.user.department
    };

    // Validate that user is from HR department
    if (hrEmployee.department !== 'HR') {
      return res.status(403).json({
        success: false,
        message: 'Only HR employees can create call activities'
      });
    }

    // Parse call date
    let parsedCallDate = new Date();
    if (callDate) {
      parsedCallDate = new Date(callDate);
    }

    // Create HR activity record
    const hrActivity = new HRActivity({
      hrEmployee,
      callDetails: {
        mobileNo,
        name,
        purpose,
        callDuration,
        callDate: parsedCallDate,
        callTime,
        callStatus
      },
      notes,
      category,
      outcome,
      followUpRequired,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      followUpNotes,
      location,
      relatedEmployee: relatedEmployeeEmpId ? {
        empId: relatedEmployeeEmpId,
        employeeName: relatedEmployeeName,
        department: relatedEmployeeDepartment
      } : undefined
    });

    await hrActivity.save();

    console.log(`📞 HR Activity created by ${hrEmployee.employeeName}: ${name} (${mobileNo})`);

    res.status(201).json({
      success: true,
      message: 'HR call activity created successfully',
      data: {
        id: hrActivity._id,
        hrEmployee: hrActivity.hrEmployee,
        callDetails: hrActivity.callDetails,
        category: hrActivity.category,
        outcome: hrActivity.outcome,
        followUpRequired: hrActivity.followUpRequired,
        createdAt: hrActivity.createdAt
      }
    });

  } catch (err) {
    console.error('❌ Error creating HR activity:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📋 GET: Get all HR activities (no filters)
export const getAllHRActivities = async (req, res) => {
  try {
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build query - get all active records
    let query = { status: 'active' };

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    let sort = {};
    if (sortBy === 'callDate') {
      sort['callDetails.callDate'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'createdAt') {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'callDuration') {
      sort['callDetails.callDuration'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }

    // Execute query
    const activities = await HRActivity.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await HRActivity.countDocuments(query);

    // Calculate statistics
    const stats = await HRActivity.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalDuration: { $sum: '$callDetails.callDuration' },
          avgDuration: { $avg: '$callDetails.callDuration' },
          completedCalls: {
            $sum: { $cond: [{ $eq: ['$callDetails.callStatus', 'completed'] }, 1, 0] }
          },
          missedCalls: {
            $sum: { $cond: [{ $eq: ['$callDetails.callStatus', 'missed'] }, 1, 0] }
          }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalCalls: 0,
      totalDuration: 0,
      avgDuration: 0,
      completedCalls: 0,
      missedCalls: 0
    };

    // Format response
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      hrEmployee: activity.hrEmployee,
      callDetails: {
        ...activity.callDetails,
        callDate: activity.callDetails.callDate,
        formattedCallDuration: activity.callDetails.callDuration > 0 
          ? `${Math.floor(activity.callDetails.callDuration / 60)}h ${activity.callDetails.callDuration % 60}m`
          : '0m'
      },
      category: activity.category,
      outcome: activity.outcome,
      followUpRequired: activity.followUpRequired,
      followUpDate: activity.followUpDate,
      relatedEmployee: activity.relatedEmployee,
      notes: activity.notes,
      location: activity.location,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: formattedActivities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      statistics: {
        totalCalls: statistics.totalCalls,
        totalDuration: statistics.totalDuration,
        avgDuration: Math.round(statistics.avgDuration || 0),
        completedCalls: statistics.completedCalls,
        missedCalls: statistics.missedCalls,
        avgDurationFormatted: statistics.avgDuration > 0 
          ? `${Math.floor(statistics.avgDuration / 60)}h ${Math.round(statistics.avgDuration % 60)}m`
          : '0m'
      }
    });

  } catch (err) {
    console.error('❌ Error fetching all HR activities:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📋 GET: Get HR activities with filters
export const getHRActivities = async (req, res) => {
  try {
    const {
      date,
      startDate,
      endDate,
      hrEmployeeId,
      category,
      outcome,
      callStatus,
      mobileNo,
      name,
      page = 1,
      limit = 20,
      sortBy = 'callDate',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = { status: 'active' };

    // Date filters
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query['callDetails.callDate'] = { $gte: targetDate, $lt: nextDay };
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      query['callDetails.callDate'] = { $gte: start, $lte: end };
    }

    // HR Employee filter
    if (hrEmployeeId) {
      query['hrEmployee.empId'] = hrEmployeeId;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Outcome filter
    if (outcome) {
      query.outcome = outcome;
    }

    // Call status filter
    if (callStatus) {
      query['callDetails.callStatus'] = callStatus;
    }

    // Mobile number filter
    if (mobileNo) {
      query['callDetails.mobileNo'] = { $regex: mobileNo, $options: 'i' };
    }

    // Name filter
    if (name) {
      query['callDetails.name'] = { $regex: name, $options: 'i' };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    let sort = {};
    if (sortBy === 'callDate') {
      sort['callDetails.callDate'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'createdAt') {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'callDuration') {
      sort['callDetails.callDuration'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }

    // Execute query
    const activities = await HRActivity.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await HRActivity.countDocuments(query);

    // Calculate statistics
    const stats = await HRActivity.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalDuration: { $sum: '$callDetails.callDuration' },
          avgDuration: { $avg: '$callDetails.callDuration' },
          completedCalls: {
            $sum: { $cond: [{ $eq: ['$callDetails.callStatus', 'completed'] }, 1, 0] }
          },
          missedCalls: {
            $sum: { $cond: [{ $eq: ['$callDetails.callStatus', 'missed'] }, 1, 0] }
          }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalCalls: 0,
      totalDuration: 0,
      avgDuration: 0,
      completedCalls: 0,
      missedCalls: 0
    };

    // Format response
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      hrEmployee: activity.hrEmployee,
      callDetails: {
        ...activity.callDetails,
        callDate: activity.callDetails.callDate,
        formattedCallDuration: activity.callDetails.callDuration > 0 
          ? `${Math.floor(activity.callDetails.callDuration / 60)}h ${activity.callDetails.callDuration % 60}m`
          : '0m'
      },
      category: activity.category,
      outcome: activity.outcome,
      followUpRequired: activity.followUpRequired,
      followUpDate: activity.followUpDate,
      relatedEmployee: activity.relatedEmployee,
      notes: activity.notes,
      location: activity.location,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: formattedActivities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      statistics: {
        totalCalls: statistics.totalCalls,
        totalDuration: statistics.totalDuration,
        avgDuration: Math.round(statistics.avgDuration || 0),
        completedCalls: statistics.completedCalls,
        missedCalls: statistics.missedCalls,
        avgDurationFormatted: statistics.avgDuration > 0 
          ? `${Math.floor(statistics.avgDuration / 60)}h ${Math.round(statistics.avgDuration % 60)}m`
          : '0m'
      }
    });

  } catch (err) {
    console.error('❌ Error fetching HR activities:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📊 GET: Get HR activity statistics
export const getHRActivityStats = async (req, res) => {
  try {
    const { startDate, endDate, hrEmployeeId } = req.query;

    let matchQuery = { status: 'active' };

    // Date range filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      matchQuery['callDetails.callDate'] = { $gte: start, $lte: end };
    }

    // HR Employee filter
    if (hrEmployeeId) {
      matchQuery['hrEmployee.empId'] = hrEmployeeId;
    }

    const stats = await HRActivity.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalDuration: { $sum: '$callDetails.callDuration' },
          avgDuration: { $avg: '$callDetails.callDuration' },
          completedCalls: {
            $sum: { $cond: [{ $eq: ['$callDetails.callStatus', 'completed'] }, 1, 0] }
          },
          missedCalls: {
            $sum: { $cond: [{ $eq: ['$callDetails.callStatus', 'missed'] }, 1, 0] }
          },
          noAnswerCalls: {
            $sum: { $cond: [{ $eq: ['$callDetails.callStatus', 'no_answer'] }, 1, 0] }
          },
          busyCalls: {
            $sum: { $cond: [{ $eq: ['$callDetails.callStatus', 'busy'] }, 1, 0] }
          }
        }
      }
    ]);

    // Category-wise statistics
    const categoryStats = await HRActivity.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalDuration: { $sum: '$callDetails.callDuration' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Outcome-wise statistics
    const outcomeStats = await HRActivity.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$outcome',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // HR Employee-wise statistics
    const hrEmployeeStats = await HRActivity.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$hrEmployee.empId',
          employeeName: { $first: '$hrEmployee.employeeName' },
          totalCalls: { $sum: 1 },
          totalDuration: { $sum: '$callDetails.callDuration' },
          completedCalls: {
            $sum: { $cond: [{ $eq: ['$callDetails.callStatus', 'completed'] }, 1, 0] }
          }
        }
      },
      { $sort: { totalCalls: -1 } }
    ]);

    const result = stats[0] || {
      totalCalls: 0,
      totalDuration: 0,
      avgDuration: 0,
      completedCalls: 0,
      missedCalls: 0,
      noAnswerCalls: 0,
      busyCalls: 0
    };

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalCalls: result.totalCalls,
          totalDuration: result.totalDuration,
          avgDuration: Math.round(result.avgDuration || 0),
          avgDurationFormatted: result.avgDuration > 0 
            ? `${Math.floor(result.avgDuration / 60)}h ${Math.round(result.avgDuration % 60)}m`
            : '0m',
          completedCalls: result.completedCalls,
          missedCalls: result.missedCalls,
          noAnswerCalls: result.noAnswerCalls,
          busyCalls: result.busyCalls,
          completionRate: result.totalCalls > 0 
            ? Math.round((result.completedCalls / result.totalCalls) * 100)
            : 0
        },
        categoryStats,
        outcomeStats,
        hrEmployeeStats
      }
    });

  } catch (err) {
    console.error('❌ Error fetching HR activity stats:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📞 GET: Get specific HR activity by ID
export const getHRActivityById = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await HRActivity.findById(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'HR activity not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: activity._id,
        hrEmployee: activity.hrEmployee,
        callDetails: {
          ...activity.callDetails.toObject(),
          formattedCallDuration: activity.formattedCallDuration
        },
        category: activity.category,
        outcome: activity.outcome,
        followUpRequired: activity.followUpRequired,
        followUpDate: activity.followUpDate,
        followUpNotes: activity.followUpNotes,
        relatedEmployee: activity.relatedEmployee,
        notes: activity.notes,
        location: activity.location,
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt
      }
    });

  } catch (err) {
    console.error('❌ Error fetching HR activity:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 🔄 PUT: Update HR activity
export const updateHRActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const activity = await HRActivity.findById(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'HR activity not found'
      });
    }

    // Only allow HR employees to update their own activities
    if (activity.hrEmployee.empId !== req.user.empId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own activities'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'callDetails.mobileNo',
      'callDetails.name',
      'callDetails.purpose',
      'callDetails.callDuration',
      'callDetails.callTime',
      'callDetails.callStatus',
      'notes',
      'category',
      'outcome',
      'followUpRequired',
      'followUpDate',
      'followUpNotes',
      'location',
      'relatedEmployee'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    const updatedActivity = await HRActivity.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    console.log(`📞 HR Activity updated: ${updatedActivity.callDetails.name}`);

    res.status(200).json({
      success: true,
      message: 'HR activity updated successfully',
      data: {
        id: updatedActivity._id,
        hrEmployee: updatedActivity.hrEmployee,
        callDetails: updatedActivity.callDetails,
        category: updatedActivity.category,
        outcome: updatedActivity.outcome,
        followUpRequired: updatedActivity.followUpRequired,
        updatedAt: updatedActivity.updatedAt
      }
    });

  } catch (err) {
    console.error('❌ Error updating HR activity:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 🗑️ DELETE: Delete HR activity (soft delete)
export const deleteHRActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await HRActivity.findById(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'HR activity not found'
      });
    }

    // Only allow HR employees to delete their own activities or admins
    if (activity.hrEmployee.empId !== req.user.empId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own activities'
      });
    }

    // Soft delete
    activity.status = 'deleted';
    await activity.save();

    console.log(`🗑️ HR Activity deleted: ${activity.callDetails.name}`);

    res.status(200).json({
      success: true,
      message: 'HR activity deleted successfully'
    });

  } catch (err) {
    console.error('❌ Error deleting HR activity:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
}; 