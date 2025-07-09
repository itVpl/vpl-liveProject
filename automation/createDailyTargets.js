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

// Function to create daily targets for all active employees
export const createDailyTargetsForAllEmployees = async () => {
  try {
    console.log('🔄 Starting daily target creation process...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all active employees
    const employees = await Employee.find({ 
      status: 'active',
      department: { $in: ['sales', 'cmt'] } // Only create targets for sales and cmt departments
    });

    console.log(`📊 Found ${employees.length} active employees for target creation`);

    let createdCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const employee of employees) {
      try {
        // Check if target already exists for today
        const existingTarget = await DayTarget.findOne({
          empId: employee.empId,
          date: { $gte: today, $lt: tomorrow }
        });

        if (existingTarget) {
          console.log(`⏭️ Target already exists for ${employee.empId} (${employee.employeeName})`);
          skippedCount++;
          continue;
        }

        // Set default targets based on department
        let defaultTargets = {};
        if (employee.department === 'sales') {
          defaultTargets = {
            salesTargets: {
              dailyCalls: 100,
              talkTimeHours: 3,
              rateRequests: 2,
              deliveryOrders: 2  // Alternative target if calls not achieved
            }
          };
        } else if (employee.department === 'cmt') {
          defaultTargets = {
            cmtTargets: {
              trackingCompanies: 3
            }
          };
        }

        // Create new target
        const newTarget = await DayTarget.create({
          empId: employee.empId,
          employeeName: employee.employeeName,
          department: employee.department,
          date: today,
          ...defaultTargets,
          assignedBy: 'SYSTEM_AUTO',
          notes: 'Automatically created daily target'
        });

        console.log(`✅ Created target for ${employee.empId} (${employee.employeeName}) - ${employee.department}`);
        createdCount++;
      } catch (err) {
        console.error(`❌ Error creating target for ${employee.empId}:`, err.message);
        errors.push(`Error for ${employee.empId}: ${err.message}`);
      }
    }

    console.log(`\n📈 Daily Target Creation Summary:`);
    console.log(`✅ Created: ${createdCount} targets`);
    console.log(`⏭️ Skipped: ${skippedCount} (already exist)`);
    console.log(`❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      errors.forEach(error => console.log(`   - ${error}`));
    }

    return {
      success: true,
      created: createdCount,
      skipped: skippedCount,
      errors: errors.length,
      errorDetails: errors
    };

  } catch (err) {
    console.error('❌ Error in createDailyTargetsForAllEmployees:', err);
    return {
      success: false,
      error: err.message
    };
  }
};

// Function to check and mark overdue targets
export const checkOverdueTargets = async () => {
  try {
    console.log('🔄 Checking for overdue targets...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Find targets from yesterday that are not completed
    const overdueTargets = await DayTarget.find({
      date: { $lt: today },
      status: { $in: ['pending', 'in_progress'] }
    });

    console.log(`📊 Found ${overdueTargets.length} overdue targets`);

    let updatedCount = 0;
    for (const target of overdueTargets) {
      try {
        target.status = 'overdue';
        await target.save();
        console.log(`⚠️ Marked target as overdue for ${target.empId} (${target.employeeName})`);
        updatedCount++;
      } catch (err) {
        console.error(`❌ Error updating overdue target for ${target.empId}:`, err.message);
      }
    }

    console.log(`✅ Updated ${updatedCount} targets as overdue`);
    return {
      success: true,
      updated: updatedCount
    };

  } catch (err) {
    console.error('❌ Error in checkOverdueTargets:', err);
    return {
      success: false,
      error: err.message
    };
  }
};

// Function to get daily target statistics
export const getDailyTargetStats = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTargets = await DayTarget.find({
      date: { $gte: today, $lt: tomorrow }
    });

    const stats = {
      total: todayTargets.length,
      completed: todayTargets.filter(t => t.status === 'completed').length,
      inProgress: todayTargets.filter(t => t.status === 'in_progress').length,
      pending: todayTargets.filter(t => t.status === 'pending').length,
      overdue: todayTargets.filter(t => t.status === 'overdue').length,
      byDepartment: {}
    };

    // Group by department
    const salesTargets = todayTargets.filter(t => t.department === 'sales');
    const cmtTargets = todayTargets.filter(t => t.department === 'cmt');

    stats.byDepartment.sales = {
      total: salesTargets.length,
      completed: salesTargets.filter(t => t.status === 'completed').length,
      inProgress: salesTargets.filter(t => t.status === 'in_progress').length,
      pending: salesTargets.filter(t => t.status === 'pending').length
    };

    stats.byDepartment.cmt = {
      total: cmtTargets.length,
      completed: cmtTargets.filter(t => t.status === 'completed').length,
      inProgress: cmtTargets.filter(t => t.status === 'in_progress').length,
      pending: cmtTargets.filter(t => t.status === 'pending').length
    };

    return stats;
  } catch (err) {
    console.error('❌ Error in getDailyTargetStats:', err);
    return null;
  }
};

// Export for use in other files
export default {
  createDailyTargetsForAllEmployees,
  checkOverdueTargets,
  getDailyTargetStats
}; 