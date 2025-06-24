import DailyTask from '../models/DailyTask.js';
import { Employee } from '../models/inhouseUserModel.js';
import moment from 'moment';

// Define department-specific daily tasks
const taskTemplates = {
  Sales: [
    { type: 'calls', target: 100, mandatory: true },
    { type: 'emails', target: 15, mandatory: true },
    { type: 'rateRequest', target: 2, mandatory: true },
    { type: 'talktime', target: 180, mandatory: true }, // in minutes
    { type: 'deliveryOrder', target: 1, mandatory: false }
  ],
  CMT: [
    { type: 'truckCompany', target: 3, mandatory: true }
  ],
  // Add more departments as needed
  Operations: [
    { type: 'calls', target: 50, mandatory: true },
    { type: 'emails', target: 15, mandatory: true },
    { type: 'deliveryOrder', target: 2, mandatory: true }
  ],
  Admin: [
    { type: 'emails', target: 10, mandatory: true },
    { type: 'calls', target: 20, mandatory: true }
  ],
  HR: [
    { type: 'emails', target: 15, mandatory: true },
    { type: 'calls', target: 25, mandatory: true }
  ]
};

// Default template for departments not explicitly defined
const defaultTemplate = [
  { type: 'calls', target: 30, mandatory: true },
  { type: 'emails', target: 10, mandatory: true }
];

// Auto-assign daily tasks
export const assignDailyTasks = async (req, res) => {
  try {
    const user = req.user;
    const today = moment().format('YYYY-MM-DD');

    console.log('🔍 Debug - User:', {
      empId: user.empId,
      employeeName: user.employeeName,
      department: user.department,
      role: user.role
    });

    const existing = await DailyTask.findOne({ empId: user.empId, date: today });
    if (existing) {
      console.log('✅ Tasks already exist for today');
      return res.status(200).json({ success: true, message: 'Tasks already assigned', task: existing });
    }

    // Check if user is Sales department admin - if yes, assign Sales tasks with modified delivery order target
    let template;
    if (user.department === 'Sales' && user.role === 'admin') {
      template = [
        { type: 'calls', target: 100, mandatory: true },
        { type: 'emails', target: 20, mandatory: true },
        { type: 'rateRequest', target: 2, mandatory: true },
        { type: 'talktime', target: 180, mandatory: true }, // in minutes
        { type: 'deliveryOrder', target: 5, mandatory: false } // Increased to 5 for Sales admin
      ];
      console.log('🔍 Debug - Sales Admin user, assigned Sales template with delivery order target 5');
    } else {
      template = taskTemplates[user.department] || defaultTemplate;
      console.log('🔍 Debug - Regular user, Template for department:', user.department, ':', template);
    }

    const newTask = await DailyTask.create({
      empId: user.empId,
      employeeName: user.employeeName,
      department: user.department,
      date: today,
      tasks: template
    });

    console.log('✅ New task created:', newTask);
    res.status(200).json({ success: true, message: 'Daily tasks assigned', task: newTask });
  } catch (err) {
    console.error('❌ Error in assignDailyTasks:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update completed value for a specific task
export const updateTaskProgress = async (req, res) => {
  try {
    const { type, completed } = req.body;
    const today = moment().format('YYYY-MM-DD');
    const taskDoc = await DailyTask.findOne({ empId: req.user.empId, date: today });

    if (!taskDoc) {
      return res.status(404).json({ success: false, message: 'Task not found for today' });
    }

    const taskToUpdate = taskDoc.tasks.find(t => t.type === type);
    if (!taskToUpdate) {
      return res.status(404).json({ success: false, message: 'Task type not found' });
    }

    taskToUpdate.completed = completed;
    
    // Check if all mandatory tasks are completed
    const unmetMandatory = taskDoc.tasks.filter(t => t.mandatory && t.completed < t.target);
    taskDoc.completed = unmetMandatory.length === 0;
    
    await taskDoc.save();

    console.log(`✅ Task ${type} updated to ${completed}. Overall completion: ${taskDoc.completed}`);

    res.status(200).json({ 
      success: true, 
      message: 'Task progress updated', 
      task: taskDoc,
      isCompleted: taskDoc.completed
    });
  } catch (err) {
    console.error('❌ Error in updateTaskProgress:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get today's tasks
export const getMyTodayTasks = async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const task = await DailyTask.findOne({ empId: req.user.empId, date: today });
    if (!task) {
      return res.status(404).json({ success: false, message: 'No tasks assigned today' });
    }

    res.status(200).json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Check completion status (optional CRON use)
export const evaluateTasks = async () => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const tasks = await DailyTask.find({ date: today });

    for (const task of tasks) {
      const unmetMandatory = task.tasks.filter(t => t.mandatory && t.completed < t.target);
      task.completed = unmetMandatory.length === 0;
      await task.save();
    }
  } catch (err) {
    console.error('Evaluation error:', err);
  }
};
