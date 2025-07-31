import { HRActivity } from '../models/hrActivityModel.js';
import { Employee } from '../models/inhouseUserModel.js';
import moment from 'moment-timezone';

// 📞 POST: Create new HR call activity
export const createHRCallActivity = async (req, res) => {
  try {
    const {
      mobileNo,
      name,
      purpose,
      duration = 0,
      activityDate,
      notes
    } = req.body;

    // Validate required fields for call
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

    // Parse activity date (only date, no time)
    let parsedActivityDate = new Date();
    if (activityDate) {
      parsedActivityDate = new Date(activityDate);
      parsedActivityDate.setHours(0, 0, 0, 0);
    }

    // Create HR call activity record
    const hrActivity = new HRActivity({
      hrEmployee,
      activityType: 'call',
      callDetails: {
        mobileNo,
        name,
        purpose,
        duration
      },
      emailDetails: undefined, // Explicitly set to undefined for call activities
      activityDate: parsedActivityDate,
      notes
    });

    await hrActivity.save();

    console.log(`📞 HR Call Activity created by ${hrEmployee.employeeName}: ${name} (${mobileNo})`);

    res.status(201).json({
      success: true,
      message: 'HR call activity created successfully',
      data: {
        id: hrActivity._id,
        hrEmployee: hrActivity.hrEmployee,
        callDetails: hrActivity.callDetails,
        activityType: hrActivity.activityType,
        activityDate: hrActivity.activityDate,
        createdAt: hrActivity.createdAt
      }
    });

  } catch (err) {
    console.error('❌ Error creating HR call activity:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📧 POST: Create new HR email activity
export const createHREmailActivity = async (req, res) => {
  try {
    const {
      email,
      emailType = 'send',
      purpose,
      activityDate,
      notes
    } = req.body;

    // Validate required fields for email
    if (!email || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email address and purpose are required'
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
        message: 'Only HR employees can create email activities'
      });
    }

    // Parse activity date (only date, no time)
    let parsedActivityDate = new Date();
    if (activityDate) {
      parsedActivityDate = new Date(activityDate);
      parsedActivityDate.setHours(0, 0, 0, 0);
    }

    // Create HR email activity record
    const hrActivity = new HRActivity({
      hrEmployee,
      activityType: 'email',
      callDetails: undefined, // Explicitly set to undefined for email activities
      emailDetails: {
        email,
        emailType,
        purpose
      },
      activityDate: parsedActivityDate,
      notes
    });

    await hrActivity.save();

    console.log(`📧 HR Email Activity created by ${hrEmployee.employeeName}: ${email}`);

    res.status(201).json({
      success: true,
      message: 'HR email activity created successfully',
      data: {
        id: hrActivity._id,
        hrEmployee: hrActivity.hrEmployee,
        emailDetails: hrActivity.emailDetails,
        activityType: hrActivity.activityType,
        activityDate: hrActivity.activityDate,
        createdAt: hrActivity.createdAt
      }
    });

  } catch (err) {
    console.error('❌ Error creating HR email activity:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📞 GET: Get all HR call activities by date
export const getAllHRCallActivitiesByDate = async (req, res) => {
  try {
    const { date, page = 1, limit = 50, sortBy = 'activityDate', sortOrder = 'desc' } = req.query;

    // Validate date parameter
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required (format: YYYY-MM-DD)'
      });
    }

    // Parse date
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Build query - get call activities for specific date
    let query = { 
      status: 'active', 
      activityType: 'call',
      activityDate: { $gte: targetDate, $lt: nextDay }
    };

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    let sort = {};
    if (sortBy === 'activityDate') {
      sort.activityDate = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'createdAt') {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'duration') {
      sort['callDetails.duration'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.activityDate = -1;
    }

    // Execute query
    const activities = await HRActivity.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await HRActivity.countDocuments(query);

    // Calculate statistics for the specific date
    const stats = await HRActivity.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalDuration: { $sum: '$callDetails.duration' },
          avgDuration: { $avg: '$callDetails.duration' }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalCalls: 0,
      totalDuration: 0,
      avgDuration: 0
    };

    // Format response
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      hrEmployee: activity.hrEmployee,
      callDetails: activity.callDetails ? {
        ...activity.callDetails,
        durationFormatted: activity.callDetails.duration > 0 
          ? `${Math.floor(activity.callDetails.duration / 60)}h ${activity.callDetails.duration % 60}m`
          : '0m'
      } : null,
      activityDate: activity.activityDate,
      notes: activity.notes,
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
        date: date,
        totalCalls: statistics.totalCalls,
        totalDuration: statistics.totalDuration,
        avgDuration: Math.round(statistics.avgDuration || 0),
        avgDurationFormatted: statistics.avgDuration > 0 
          ? `${Math.floor(statistics.avgDuration / 60)}h ${Math.round(statistics.avgDuration % 60)}m`
          : '0m'
      }
    });

  } catch (err) {
    console.error('❌ Error fetching HR call activities by date:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📧 GET: Get all HR email activities by date
export const getAllHREmailActivitiesByDate = async (req, res) => {
  try {
    const { date, page = 1, limit = 50, sortBy = 'activityDate', sortOrder = 'desc' } = req.query;

    // Validate date parameter
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required (format: YYYY-MM-DD)'
      });
    }

    // Parse date
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Build query - get email activities for specific date
    let query = { 
      status: 'active', 
      activityType: 'email',
      activityDate: { $gte: targetDate, $lt: nextDay }
    };

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    let sort = {};
    if (sortBy === 'activityDate') {
      sort.activityDate = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'createdAt') {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.activityDate = -1;
    }

    // Execute query
    const activities = await HRActivity.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await HRActivity.countDocuments(query);

    // Calculate statistics for the specific date
    const stats = await HRActivity.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalEmails: { $sum: 1 },
          sendEmails: {
            $sum: { $cond: [{ $eq: ['$emailDetails.emailType', 'send'] }, 1, 0] }
          },
          replyEmails: {
            $sum: { $cond: [{ $eq: ['$emailDetails.emailType', 'reply'] }, 1, 0] }
          }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalEmails: 0,
      sendEmails: 0,
      replyEmails: 0
    };

    // Format response
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      hrEmployee: activity.hrEmployee,
      emailDetails: activity.emailDetails ? {
        ...activity.emailDetails,
        emailType: activity.emailDetails.emailType
      } : null,
      activityDate: activity.activityDate,
      notes: activity.notes,
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
        date: date,
        totalEmails: statistics.totalEmails,
        sendEmails: statistics.sendEmails,
        replyEmails: statistics.replyEmails
      }
    });

  } catch (err) {
    console.error('❌ Error fetching HR email activities by date:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📧 GET: Get HR email activities by date
export const getHREmailActivitiesByDate = async (req, res) => {
  try {
    const { date, page = 1, limit = 50, sortBy = 'emailDate', sortOrder = 'desc' } = req.query;

    // Validate date parameter
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required (format: YYYY-MM-DD)'
      });
    }

    // Parse date
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Build query - get email activities for specific date
    let query = { 
      status: 'active', 
      activityType: 'email',
      'emailDetails.emailDate': { $gte: targetDate, $lt: nextDay }
    };

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    let sort = {};
    if (sortBy === 'emailDate') {
      sort['emailDetails.emailDate'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'createdAt') {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'emailTime') {
      sort['emailDetails.emailTime'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort['emailDetails.emailDate'] = -1;
    }

    // Execute query
    const activities = await HRActivity.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await HRActivity.countDocuments(query);

    // Calculate statistics for the specific date
    const stats = await HRActivity.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalEmails: { $sum: 1 },
          sentEmails: {
            $sum: { $cond: [{ $eq: ['$emailDetails.emailStatus', 'sent'] }, 1, 0] }
          },
          draftEmails: {
            $sum: { $cond: [{ $eq: ['$emailDetails.emailStatus', 'draft'] }, 1, 0] }
          },
          failedEmails: {
            $sum: { $cond: [{ $eq: ['$emailDetails.emailStatus', 'failed'] }, 1, 0] }
          },
          scheduledEmails: {
            $sum: { $cond: [{ $eq: ['$emailDetails.emailStatus', 'scheduled'] }, 1, 0] }
          }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalEmails: 0,
      sentEmails: 0,
      draftEmails: 0,
      failedEmails: 0,
      scheduledEmails: 0
    };

    // Format response
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      hrEmployee: activity.hrEmployee,
      emailDetails: activity.emailDetails ? {
        ...activity.emailDetails,
        emailDate: activity.emailDetails.emailDate
      } : null,
      category: activity.category,
      activityType: activity.activityType,
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
        date: date,
        totalEmails: statistics.totalEmails,
        sentEmails: statistics.sentEmails,
        draftEmails: statistics.draftEmails,
        failedEmails: statistics.failedEmails,
        scheduledEmails: statistics.scheduledEmails,
        successRate: statistics.totalEmails > 0 
          ? Math.round((statistics.sentEmails / statistics.totalEmails) * 100)
          : 0
      }
    });

  } catch (err) {
    console.error('❌ Error fetching HR email activities by date:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📧 GET: Get all HR email activities (no filters)
export const getAllHREmailActivities = async (req, res) => {
  try {
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build query - get all active email records
    let query = { status: 'active', activityType: 'email' };

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    let sort = {};
    if (sortBy === 'emailDate') {
      sort['emailDetails.emailDate'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'createdAt') {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
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
          totalEmails: { $sum: 1 },
          sentEmails: {
            $sum: { $cond: [{ $eq: ['$emailDetails.emailStatus', 'sent'] }, 1, 0] }
          },
          draftEmails: {
            $sum: { $cond: [{ $eq: ['$emailDetails.emailStatus', 'draft'] }, 1, 0] }
          },
          failedEmails: {
            $sum: { $cond: [{ $eq: ['$emailDetails.emailStatus', 'failed'] }, 1, 0] }
          },
          scheduledEmails: {
            $sum: { $cond: [{ $eq: ['$emailDetails.emailStatus', 'scheduled'] }, 1, 0] }
          }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalEmails: 0,
      sentEmails: 0,
      draftEmails: 0,
      failedEmails: 0,
      scheduledEmails: 0
    };

    // Format response
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      hrEmployee: activity.hrEmployee,
      emailDetails: activity.emailDetails ? {
        ...activity.emailDetails,
        emailDate: activity.emailDetails.emailDate
      } : null,
      category: activity.category,
      activityType: activity.activityType,
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
        totalEmails: statistics.totalEmails,
        sentEmails: statistics.sentEmails,
        draftEmails: statistics.draftEmails,
        failedEmails: statistics.failedEmails,
        scheduledEmails: statistics.scheduledEmails,
        successRate: statistics.totalEmails > 0 
          ? Math.round((statistics.sentEmails / statistics.totalEmails) * 100)
          : 0
      }
    });

  } catch (err) {
    console.error('❌ Error fetching all HR email activities:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📞 GET: Get all HR call activities (no filters)
export const getAllHRCallActivities = async (req, res) => {
  try {
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build query - get all active call records
    let query = { status: 'active', activityType: 'call' };

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
      callDetails: activity.callDetails ? {
        ...activity.callDetails,
        callDate: activity.callDetails.callDate,
        formattedCallDuration: activity.callDetails.callDuration > 0 
          ? `${Math.floor(activity.callDetails.callDuration / 60)}h ${activity.callDetails.callDuration % 60}m`
          : '0m'
      } : null,
      category: activity.category,
      activityType: activity.activityType,
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
    console.error('❌ Error fetching all HR call activities:', err);
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

// 📅 GET: Get HR activity for specific date only
export const getHRActivityByDate = async (req, res) => {
  try {
    const { date, hrEmployeeId, includeDetails = false } = req.query;

    // Validate date parameter
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required (format: YYYY-MM-DD)'
      });
    }

    // Parse date
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Build base query for specific date
    let baseQuery = { 
      status: 'active',
      activityDate: { $gte: targetDate, $lt: nextDay }
    };

    if (hrEmployeeId) {
      baseQuery['hrEmployee.empId'] = hrEmployeeId;
    }

    // Get call activities for the date
    const callQuery = { ...baseQuery, activityType: 'call' };
    const callActivities = await HRActivity.find(callQuery).lean();

    // Get email activities for the date
    const emailQuery = { ...baseQuery, activityType: 'email' };
    const emailActivities = await HRActivity.find(emailQuery).lean();

    // Calculate call statistics
    const callStats = {
      totalCalls: callActivities.length,
      totalDuration: callActivities.reduce((sum, activity) => sum + (activity.callDetails?.duration || 0), 0),
      avgDuration: callActivities.length > 0 
        ? callActivities.reduce((sum, activity) => sum + (activity.callDetails?.duration || 0), 0) / callActivities.length 
        : 0
    };

    // Calculate email statistics
    const emailStats = {
      totalEmails: emailActivities.length,
      sendEmails: emailActivities.filter(activity => activity.emailDetails?.emailType === 'send').length,
      replyEmails: emailActivities.filter(activity => activity.emailDetails?.emailType === 'reply').length
    };

    // Calculate HR employee-wise statistics
    const hrEmployeeStats = {};
    
    [...callActivities, ...emailActivities].forEach(activity => {
      const empId = activity.hrEmployee.empId;
      if (!hrEmployeeStats[empId]) {
        hrEmployeeStats[empId] = {
          employeeName: activity.hrEmployee.employeeName,
          totalCalls: 0,
          totalEmails: 0,
          totalDuration: 0,
          sendEmails: 0,
          replyEmails: 0
        };
      }
      
      if (activity.activityType === 'call') {
        hrEmployeeStats[empId].totalCalls++;
        hrEmployeeStats[empId].totalDuration += activity.callDetails?.duration || 0;
      } else if (activity.activityType === 'email') {
        hrEmployeeStats[empId].totalEmails++;
        if (activity.emailDetails?.emailType === 'send') {
          hrEmployeeStats[empId].sendEmails++;
        } else if (activity.emailDetails?.emailType === 'reply') {
          hrEmployeeStats[empId].replyEmails++;
        }
      }
    });

    // Calculate status based on minimum requirements
    const minCallsRequired = 60;
    const minEmailsRequired = 25;
    
    const callsCompleted = callStats.totalCalls >= minCallsRequired;
    const emailsCompleted = emailStats.totalEmails >= minEmailsRequired;
    
    let status = 'incomplete';
    let statusMessage = '';
    
    if (callsCompleted && emailsCompleted) {
      status = 'completed';
      statusMessage = 'All daily targets completed';
    } else if (callsCompleted && !emailsCompleted) {
      status = 'incomplete';
      statusMessage = `Calls completed (${callStats.totalCalls}/${minCallsRequired}), but emails incomplete (${emailStats.totalEmails}/${minEmailsRequired})`;
    } else if (!callsCompleted && emailsCompleted) {
      status = 'incomplete';
      statusMessage = `Emails completed (${emailStats.totalEmails}/${minEmailsRequired}), but calls incomplete (${callStats.totalCalls}/${minCallsRequired})`;
    } else {
      status = 'incomplete';
      statusMessage = `Both calls (${callStats.totalCalls}/${minCallsRequired}) and emails (${emailStats.totalEmails}/${minEmailsRequired}) incomplete`;
    }

    // Prepare response
    const report = {
      date: date,
      status: status,
      statusMessage: statusMessage,
      summary: {
        totalActivities: callStats.totalCalls + emailStats.totalEmails,
        totalCalls: callStats.totalCalls,
        totalEmails: emailStats.totalEmails,
        totalDuration: callStats.totalDuration,
        avgCallDuration: Math.round(callStats.avgDuration || 0)
      },
      callStatistics: {
        totalCalls: callStats.totalCalls,
        totalDuration: callStats.totalDuration,
        avgDuration: Math.round(callStats.avgDuration || 0),
        avgDurationFormatted: callStats.avgDuration > 0 
          ? `${Math.floor(callStats.avgDuration / 60)}h ${Math.round(callStats.avgDuration % 60)}m`
          : '0m',
        targetCalls: minCallsRequired,
        callsCompleted: callsCompleted,
        callsRemaining: Math.max(0, minCallsRequired - callStats.totalCalls)
      },
      emailStatistics: {
        totalEmails: emailStats.totalEmails,
        sendEmails: emailStats.sendEmails,
        replyEmails: emailStats.replyEmails,
        targetEmails: minEmailsRequired,
        emailsCompleted: emailsCompleted,
        emailsRemaining: Math.max(0, minEmailsRequired - emailStats.totalEmails)
      },
      hrEmployeeStats: Object.values(hrEmployeeStats)
    };

    // Include detailed activities if requested
    if (includeDetails === 'true') {
      report.detailedActivities = {
        calls: callActivities.map(activity => ({
          id: activity._id,
          hrEmployee: activity.hrEmployee,
          callDetails: activity.callDetails,
          activityDate: activity.activityDate,
          createdAt: activity.createdAt
        })),
        emails: emailActivities.map(activity => ({
          id: activity._id,
          hrEmployee: activity.hrEmployee,
          emailDetails: activity.emailDetails,
          activityDate: activity.activityDate,
          createdAt: activity.createdAt
        }))
      };
    }

    res.status(200).json({
      success: true,
      message: `HR Activity Report for ${date}`,
      data: report
    });

  } catch (err) {
    console.error('❌ Error fetching HR activity for specific date:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📊 GET: Get HR activity reports (date-wise)
export const getHRActivityReports = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      hrEmployeeId, 
      reportType = 'daily', // daily, weekly, monthly
      includeDetails = false 
    } = req.query;

    // Validate date parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required (format: YYYY-MM-DD)'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Build base query
    let baseQuery = { 
      status: 'active',
      createdAt: { $gte: start, $lte: end }
    };

    if (hrEmployeeId) {
      baseQuery['hrEmployee.empId'] = hrEmployeeId;
    }

    // Get call activities
    const callQuery = { ...baseQuery, activityType: 'call' };
    const callActivities = await HRActivity.find(callQuery).lean();

    // Get email activities
    const emailQuery = { ...baseQuery, activityType: 'email' };
    const emailActivities = await HRActivity.find(emailQuery).lean();

    // Calculate call statistics
    const callStats = {
      totalCalls: callActivities.length,
      totalDuration: callActivities.reduce((sum, activity) => sum + (activity.callDetails?.callDuration || 0), 0),
      avgDuration: callActivities.length > 0 
        ? callActivities.reduce((sum, activity) => sum + (activity.callDetails?.callDuration || 0), 0) / callActivities.length 
        : 0,
      completedCalls: callActivities.filter(activity => activity.callDetails?.callStatus === 'completed').length,
      missedCalls: callActivities.filter(activity => activity.callDetails?.callStatus === 'missed').length,
      noAnswerCalls: callActivities.filter(activity => activity.callDetails?.callStatus === 'no_answer').length,
      busyCalls: callActivities.filter(activity => activity.callDetails?.callStatus === 'busy').length
    };

    // Calculate email statistics
    const emailStats = {
      totalEmails: emailActivities.length,
      sentEmails: emailActivities.filter(activity => activity.emailDetails?.emailStatus === 'sent').length,
      draftEmails: emailActivities.filter(activity => activity.emailDetails?.emailStatus === 'draft').length,
      failedEmails: emailActivities.filter(activity => activity.emailDetails?.emailStatus === 'failed').length,
      scheduledEmails: emailActivities.filter(activity => activity.emailDetails?.emailStatus === 'scheduled').length
    };

    // Calculate category-wise statistics
    const callCategories = {};
    const emailCategories = {};

    callActivities.forEach(activity => {
      const category = activity.category || 'other';
      callCategories[category] = (callCategories[category] || 0) + 1;
    });

    emailActivities.forEach(activity => {
      const category = activity.category || 'other';
      emailCategories[category] = (emailCategories[category] || 0) + 1;
    });

    // Calculate outcome statistics
    const callOutcomes = {};
    const emailOutcomes = {};

    callActivities.forEach(activity => {
      const outcome = activity.outcome || 'neutral';
      callOutcomes[outcome] = (callOutcomes[outcome] || 0) + 1;
    });

    emailActivities.forEach(activity => {
      const outcome = activity.outcome || 'neutral';
      emailOutcomes[outcome] = (emailOutcomes[outcome] || 0) + 1;
    });

    // Calculate HR employee-wise statistics
    const hrEmployeeStats = {};
    
    [...callActivities, ...emailActivities].forEach(activity => {
      const empId = activity.hrEmployee.empId;
      if (!hrEmployeeStats[empId]) {
        hrEmployeeStats[empId] = {
          employeeName: activity.hrEmployee.employeeName,
          totalCalls: 0,
          totalEmails: 0,
          totalDuration: 0,
          completedCalls: 0,
          sentEmails: 0
        };
      }
      
      if (activity.activityType === 'call') {
        hrEmployeeStats[empId].totalCalls++;
        hrEmployeeStats[empId].totalDuration += activity.callDetails?.callDuration || 0;
        if (activity.callDetails?.callStatus === 'completed') {
          hrEmployeeStats[empId].completedCalls++;
        }
      } else if (activity.activityType === 'email') {
        hrEmployeeStats[empId].totalEmails++;
        if (activity.emailDetails?.emailStatus === 'sent') {
          hrEmployeeStats[empId].sentEmails++;
        }
      }
    });

    // Generate daily breakdown if requested
    let dailyBreakdown = null;
    if (reportType === 'daily') {
      dailyBreakdown = {};
      
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const dayCallQuery = { 
          ...baseQuery, 
          activityType: 'call',
          createdAt: { $gte: dayStart, $lte: dayEnd }
        };
        const dayEmailQuery = { 
          ...baseQuery, 
          activityType: 'email',
          createdAt: { $gte: dayStart, $lte: dayEnd }
        };

        const dayCalls = await HRActivity.countDocuments(dayCallQuery);
        const dayEmails = await HRActivity.countDocuments(dayEmailQuery);

        dailyBreakdown[dateKey] = {
          calls: dayCalls,
          emails: dayEmails,
          total: dayCalls + dayEmails
        };

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Prepare response
    const report = {
      period: {
        startDate: startDate,
        endDate: endDate,
        reportType: reportType
      },
      summary: {
        totalActivities: callStats.totalCalls + emailStats.totalEmails,
        totalCalls: callStats.totalCalls,
        totalEmails: emailStats.totalEmails,
        totalDuration: callStats.totalDuration,
        avgCallDuration: Math.round(callStats.avgDuration || 0)
      },
      callStatistics: {
        totalCalls: callStats.totalCalls,
        totalDuration: callStats.totalDuration,
        avgDuration: Math.round(callStats.avgDuration || 0),
        avgDurationFormatted: callStats.avgDuration > 0 
          ? `${Math.floor(callStats.avgDuration / 60)}h ${Math.round(callStats.avgDuration % 60)}m`
          : '0m',
        completedCalls: callStats.completedCalls,
        missedCalls: callStats.missedCalls,
        noAnswerCalls: callStats.noAnswerCalls,
        busyCalls: callStats.busyCalls,
        completionRate: callStats.totalCalls > 0 
          ? Math.round((callStats.completedCalls / callStats.totalCalls) * 100)
          : 0,
        categories: callCategories,
        outcomes: callOutcomes
      },
      emailStatistics: {
        totalEmails: emailStats.totalEmails,
        sentEmails: emailStats.sentEmails,
        draftEmails: emailStats.draftEmails,
        failedEmails: emailStats.failedEmails,
        scheduledEmails: emailStats.scheduledEmails,
        successRate: emailStats.totalEmails > 0 
          ? Math.round((emailStats.sentEmails / emailStats.totalEmails) * 100)
          : 0,
        categories: emailCategories,
        outcomes: emailOutcomes
      },
      hrEmployeeStats: Object.values(hrEmployeeStats),
      dailyBreakdown: dailyBreakdown
    };

    // Include detailed activities if requested
    if (includeDetails === 'true') {
      report.detailedActivities = {
        calls: callActivities.map(activity => ({
          id: activity._id,
          hrEmployee: activity.hrEmployee,
          callDetails: activity.callDetails,
          category: activity.category,
          outcome: activity.outcome,
          createdAt: activity.createdAt
        })),
        emails: emailActivities.map(activity => ({
          id: activity._id,
          hrEmployee: activity.hrEmployee,
          emailDetails: activity.emailDetails,
          category: activity.category,
          outcome: activity.outcome,
          createdAt: activity.createdAt
        }))
      };
    }

    res.status(200).json({
      success: true,
      message: 'HR Activity Report generated successfully',
      data: report
    });

  } catch (err) {
    console.error('❌ Error generating HR activity report:', err);
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