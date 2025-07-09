import { DayTarget } from '../models/dayTargetModel.js';
import { Employee } from '../models/inhouseUserModel.js';

// Helper function to format date
const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleString('en-IN', {
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

// 🎯 Create new daily target
export const createDayTarget = async (req, res) => {
  try {
    const {
      empId,
      department,
      salesTargets,
      cmtTargets,
      notes
    } = req.body;

    // Validate employee exists
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if target already exists for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingTarget = await DayTarget.findOne({
      empId,
      date: { $gte: today, $lt: tomorrow }
    });

    if (existingTarget) {
      return res.status(400).json({
        success: false,
        message: 'Daily target already exists for this employee today'
      });
    }

    // Set default targets based on department
    let defaultTargets = {};
    if (department === 'sales') {
      defaultTargets = {
        salesTargets: {
          dailyCalls: 100,
          talkTimeHours: 3,
          rateRequests: 2,
          deliveryOrders: 2,  // Alternative target if calls not achieved
          ...salesTargets
        }
      };
    } else if (department === 'cmt') {
      defaultTargets = {
        cmtTargets: {
          trackingCompanies: 3,
          ...cmtTargets
        }
      };
    }

    const newTarget = await DayTarget.create({
      empId,
      employeeName: employee.employeeName,
      department,
      date: today,
      ...defaultTargets,
      notes,
      assignedBy: req.user.empId
    });

    res.status(201).json({
      success: true,
      message: 'Daily target created successfully',
      target: newTarget
    });
  } catch (err) {
    console.error('Error creating day target:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📋 Get all day targets
export const getAllDayTargets = async (req, res) => {
  try {
    const { date, department, status } = req.query;
    
    let query = {};
    
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: targetDate, $lt: nextDay };
    }
    
    if (department) {
      query.department = department;
    }
    
    if (status) {
      query.status = status;
    }

    const targets = await DayTarget.find(query)
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: targets.length,
      targets
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 👤 Get day targets by employee
export const getDayTargetsByEmployee = async (req, res) => {
  try {
    const { empId } = req.params;
    const { startDate, endDate } = req.query;

    let query = { empId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const targets = await DayTarget.find(query)
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      empId,
      count: targets.length,
      targets
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📅 Get today's target for employee
export const getTodayTarget = async (req, res) => {
  try {
    const { empId } = req.params;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const target = await DayTarget.findOne({
      empId,
      date: { $gte: today, $lt: tomorrow }
    });

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'No target found for today'
      });
    }

    res.status(200).json({
      success: true,
      target
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ✅ Update target progress
export const updateTargetProgress = async (req, res) => {
  try {
    const { targetId } = req.params;
    const {
      completedCalls,
      completedTalkTime,
      completedRateRequests,
      completedDeliveryOrders,
      completedTrackingCompanies,
      notes
    } = req.body;

    const target = await DayTarget.findById(targetId);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target not found'
      });
    }

    // Update based on department
    if (target.department === 'sales') {
      if (completedCalls !== undefined) {
        target.salesTargets.completedCalls = Math.min(
          completedCalls,
          target.salesTargets.dailyCalls
        );
      }
      if (completedTalkTime !== undefined) {
        target.salesTargets.completedTalkTime = Math.min(
          completedTalkTime,
          target.salesTargets.talkTimeHours
        );
      }
      if (completedRateRequests !== undefined) {
        target.salesTargets.completedRateRequests = Math.min(
          completedRateRequests,
          target.salesTargets.rateRequests
        );
      }
      if (completedDeliveryOrders !== undefined) {
        target.salesTargets.completedDeliveryOrders = Math.min(
          completedDeliveryOrders,
          target.salesTargets.deliveryOrders
        );
      }
    } else if (target.department === 'cmt') {
      if (completedTrackingCompanies !== undefined) {
        target.cmtTargets.completedTrackingCompanies = Math.min(
          completedTrackingCompanies,
          target.cmtTargets.trackingCompanies
        );
      }
    }

    if (notes) {
      target.notes = notes;
    }

    await target.save();

    res.status(200).json({
      success: true,
      message: 'Target progress updated successfully',
      target
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 🔄 Update target status
export const updateTargetStatus = async (req, res) => {
  try {
    const { targetId } = req.params;
    const { status } = req.body;

    if (!['pending', 'in_progress', 'completed', 'overdue'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const target = await DayTarget.findByIdAndUpdate(
      targetId,
      { 
        status,
        completedAt: status === 'completed' ? new Date() : null
      },
      { new: true }
    );

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Target status updated successfully',
      target
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 📊 Get department performance report
export const getDepartmentPerformance = async (req, res) => {
  try {
    const { department, startDate, endDate } = req.query;
    
    let query = {};
    
    if (department) {
      query.department = department;
    }
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const targets = await DayTarget.find(query);
    
    // Calculate performance metrics
    const performance = {
      totalTargets: targets.length,
      completed: targets.filter(t => t.status === 'completed').length,
      inProgress: targets.filter(t => t.status === 'in_progress').length,
      pending: targets.filter(t => t.status === 'pending').length,
      overdue: targets.filter(t => t.status === 'overdue').length,
      averageProgress: 0
    };

    if (targets.length > 0) {
      const totalProgress = targets.reduce((sum, target) => sum + target.progress, 0);
      performance.averageProgress = Math.round(totalProgress / targets.length);
    }

    res.status(200).json({
      success: true,
      performance
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 🗑️ Delete target
export const deleteDayTarget = async (req, res) => {
  try {
    const { targetId } = req.params;
    
    const target = await DayTarget.findByIdAndDelete(targetId);
    
    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Target deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 🔄 Bulk create targets for department
export const bulkCreateTargets = async (req, res) => {
  try {
    const { department, date, empIds } = req.body;
    
    if (!department || !empIds || !Array.isArray(empIds)) {
      return res.status(400).json({
        success: false,
        message: 'Department and employee IDs array are required'
      });
    }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const createdTargets = [];
    const errors = [];

    for (const empId of empIds) {
      try {
        const employee = await Employee.findOne({ empId });
        if (!employee) {
          errors.push(`Employee ${empId} not found`);
          continue;
        }

        // Check if target already exists
        const existingTarget = await DayTarget.findOne({
          empId,
          date: targetDate
        });

        if (existingTarget) {
          errors.push(`Target already exists for ${empId} on ${formatDate(targetDate)}`);
          continue;
        }

        // Set default targets based on department
        let defaultTargets = {};
        if (department === 'sales') {
          defaultTargets = {
            salesTargets: {
              dailyCalls: 100,
              talkTimeHours: 3,
              rateRequests: 2,
              deliveryOrders: 2  // Alternative target if calls not achieved
            }
          };
        } else if (department === 'cmt') {
          defaultTargets = {
            cmtTargets: {
              trackingCompanies: 3
            }
          };
        }

        const newTarget = await DayTarget.create({
          empId,
          employeeName: employee.employeeName,
          department,
          date: targetDate,
          ...defaultTargets,
          assignedBy: req.user.empId
        });

        createdTargets.push(newTarget);
      } catch (err) {
        errors.push(`Error creating target for ${empId}: ${err.message}`);
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${createdTargets.length} targets`,
      created: createdTargets.length,
      errors: errors.length > 0 ? errors : undefined,
      targets: createdTargets
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 🚚 Update delivery order progress specifically
export const updateDeliveryOrderProgress = async (req, res) => {
  try {
    const { targetId } = req.params;
    const { completedDeliveryOrders, notes } = req.body;

    const target = await DayTarget.findById(targetId);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target not found'
      });
    }

    // Only allow sales department employees to update delivery orders
    if (target.department !== 'sales') {
      return res.status(403).json({
        success: false,
        message: 'Delivery orders can only be updated for sales department targets'
      });
    }

    if (completedDeliveryOrders !== undefined) {
      target.salesTargets.completedDeliveryOrders = Math.min(
        completedDeliveryOrders,
        target.salesTargets.deliveryOrders
      );
    }

    if (notes) {
      target.notes = notes;
    }

    await target.save();

    res.status(200).json({
      success: true,
      message: 'Delivery order progress updated successfully',
      target
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
}; 