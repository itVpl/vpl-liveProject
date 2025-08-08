import { SalesFollowUp } from '../models/salesFollowUpModel.js';
import { Employee } from '../models/inhouseUserModel.js';
import ErrorHandler from '../middlewares/error.js';
import { catchAsyncError } from '../middlewares/catchAsynError.js';

// Create new sales follow-up
export const createSalesFollowUp = catchAsyncError(async (req, res, next) => {
  const {
    customerName,
    address,
    phone,
    contactPerson,
    concernedPerson,
    email,
    remarks,
    callingDate,
    status,
    creditCheck,
    followUpType,
    followUpNotes,
    nextFollowUpDate
  } = req.body;

  // Validate required fields
  if (!customerName || !address || !phone || !contactPerson) {
    return next(new ErrorHandler("Please provide all required fields", 400));
  }



  // Create initial follow-up entry if provided
  const initialFollowUp = followUpType && followUpNotes ? {
    followUpDate: new Date(),
    followUpType,
    followUpNotes,
    nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
    createdBy: req.user.id
  } : null;

  const salesFollowUp = await SalesFollowUp.create({
    customerName,
    address,
    phone,
    contactPerson,
    concernedPerson,
    email,
    remarks,
    callingDate: callingDate || new Date(),
    status: status || 'New',
    creditCheck: creditCheck || 'Pending',
    createdBy: req.user.id,
    followUps: initialFollowUp ? [initialFollowUp] : []
  });

  await salesFollowUp.populate('createdBy', 'empId employeeName email department');
  await salesFollowUp.populate('followUps.createdBy', 'empId employeeName email department');

  // Get current user details
  const currentUser = await Employee.findById(req.user.id).select('empId employeeName department');

  res.status(201).json({
    success: true,
    message: "Sales follow-up created successfully",
    data: salesFollowUp,
    currentUser: {
      empId: currentUser.empId,
      employeeName: currentUser.employeeName,
      department: currentUser.department
    }
  });
});

// Get all sales follow-ups with filters
export const getAllSalesFollowUps = catchAsyncError(async (req, res, next) => {
  const {
    status,
    customerName,
    dateFrom,
    dateTo,
    page = 1,
    limit = 10
  } = req.query;

  const query = {};

  // Apply filters
  if (status) query.status = status;
  if (customerName) {
    query.customerName = { $regex: customerName, $options: 'i' };
  }
  if (dateFrom || dateTo) {
    query.callingDate = {};
    if (dateFrom) query.callingDate.$gte = new Date(dateFrom);
    if (dateTo) query.callingDate.$lte = new Date(dateTo);
  }

  const skip = (page - 1) * limit;

  const salesFollowUps = await SalesFollowUp.find(query)
    .populate('createdBy', 'empId employeeName email department')
    .populate('lastUpdatedBy', 'empId employeeName email department')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await SalesFollowUp.countDocuments(query);

  // Get current user details
  const currentUser = await Employee.findById(req.user.id).select('empId employeeName department');

  res.status(200).json({
    success: true,
    data: salesFollowUps,
    currentUser: {
      empId: currentUser.empId,
      employeeName: currentUser.employeeName,
      department: currentUser.department
    },
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  });
});

// Get sales follow-up by ID
export const getSalesFollowUpById = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const salesFollowUp = await SalesFollowUp.findById(id)
    .populate('createdBy', 'empId employeeName email department')
    .populate('lastUpdatedBy', 'empId employeeName email department')
    .populate('followUps.createdBy', 'empId employeeName email department');

  if (!salesFollowUp) {
    return next(new ErrorHandler("Sales follow-up not found", 404));
  }

  // Get current user details
  const currentUser = await Employee.findById(req.user.id).select('empId employeeName department');

  res.status(200).json({
    success: true,
    data: salesFollowUp,
    currentUser: {
      empId: currentUser.empId,
      employeeName: currentUser.employeeName,
      department: currentUser.department
    }
  });
});

// Update sales follow-up
export const updateSalesFollowUp = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;

  const salesFollowUp = await SalesFollowUp.findById(id);
  if (!salesFollowUp) {
    return next(new ErrorHandler("Sales follow-up not found", 404));
  }

  // Update lastUpdatedBy
  updateData.lastUpdatedBy = req.user.id;

  const updatedSalesFollowUp = await SalesFollowUp.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  )
    .populate('createdBy', 'empId employeeName email department')
    .populate('lastUpdatedBy', 'empId employeeName email department');

  // Get current user details
  const currentUser = await Employee.findById(req.user.id).select('empId employeeName department');

  res.status(200).json({
    success: true,
    message: "Sales follow-up updated successfully",
    data: updatedSalesFollowUp,
    currentUser: {
      empId: currentUser.empId,
      employeeName: currentUser.employeeName,
      department: currentUser.department
    }
  });
});

// Add follow-up entry
export const addFollowUpEntry = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const {
    followUpType,
    followUpNotes,
    nextFollowUpDate
  } = req.body;

  if (!followUpType || !followUpNotes) {
    return next(new ErrorHandler("Follow-up type and notes are required", 400));
  }

  const salesFollowUp = await SalesFollowUp.findById(id);
  if (!salesFollowUp) {
    return next(new ErrorHandler("Sales follow-up not found", 404));
  }

  const newFollowUp = {
    followUpDate: new Date(),
    followUpType,
    followUpNotes,
    nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
    createdBy: req.user.id
  };

  salesFollowUp.followUps.push(newFollowUp);
  salesFollowUp.lastUpdatedBy = req.user.id;

  await salesFollowUp.save();

  await salesFollowUp.populate('createdBy', 'empId employeeName email department');
  await salesFollowUp.populate('lastUpdatedBy', 'empId employeeName email department');
  await salesFollowUp.populate('followUps.createdBy', 'empId employeeName email department');

  // Get current user details
  const currentUser = await Employee.findById(req.user.id).select('empId employeeName department');

  res.status(200).json({
    success: true,
    message: "Follow-up entry added successfully",
    data: salesFollowUp,
    currentUser: {
      empId: currentUser.empId,
      employeeName: currentUser.employeeName,
      department: currentUser.department
    }
  });
});

// Update follow-up entry
export const updateFollowUpEntry = catchAsyncError(async (req, res, next) => {
  const { id, followUpId } = req.params;
  const updateData = req.body;

  const salesFollowUp = await SalesFollowUp.findById(id);
  if (!salesFollowUp) {
    return next(new ErrorHandler("Sales follow-up not found", 404));
  }

  const followUpEntry = salesFollowUp.followUps.id(followUpId);
  if (!followUpEntry) {
    return next(new ErrorHandler("Follow-up entry not found", 404));
  }

  // Update follow-up entry
  Object.assign(followUpEntry, updateData);
  salesFollowUp.lastUpdatedBy = req.user.id;

  await salesFollowUp.save();

  await salesFollowUp.populate('createdBy', 'empId employeeName email department');
  await salesFollowUp.populate('lastUpdatedBy', 'empId employeeName email department');
  await salesFollowUp.populate('followUps.createdBy', 'empId employeeName email department');

  // Get current user details
  const currentUser = await Employee.findById(req.user.id).select('empId employeeName department');

  res.status(200).json({
    success: true,
    message: "Follow-up entry updated successfully",
    data: salesFollowUp,
    currentUser: {
      empId: currentUser.empId,
      employeeName: currentUser.employeeName,
      department: currentUser.department
    }
  });
});

// Delete sales follow-up
export const deleteSalesFollowUp = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const salesFollowUp = await SalesFollowUp.findById(id);
  if (!salesFollowUp) {
    return next(new ErrorHandler("Sales follow-up not found", 404));
  }

  await SalesFollowUp.findByIdAndDelete(id);

  // Get current user details
  const currentUser = await Employee.findById(req.user.id).select('empId employeeName department');

  res.status(200).json({
    success: true,
    message: "Sales follow-up deleted successfully",
    currentUser: {
      empId: currentUser.empId,
      employeeName: currentUser.employeeName,
      department: currentUser.department
    }
  });
});



// Get sales follow-up statistics
export const getSalesFollowUpStats = catchAsyncError(async (req, res, next) => {
  const query = {};

  const stats = await SalesFollowUp.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const totalFollowUps = await SalesFollowUp.countDocuments(query);
  const todayFollowUps = await SalesFollowUp.countDocuments({
    ...query,
    callingDate: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      $lt: new Date(new Date().setHours(23, 59, 59, 999))
    }
  });

  const statusStats = {};
  stats.forEach(stat => {
    statusStats[stat._id] = stat.count;
  });

  // Get current user details
  const currentUser = await Employee.findById(req.user.id).select('empId employeeName department');

  res.status(200).json({
    success: true,
    data: {
      totalFollowUps,
      todayFollowUps,
      statusBreakdown: statusStats
    },
    currentUser: {
      empId: currentUser.empId,
      employeeName: currentUser.employeeName,
      department: currentUser.department
    }
  });
});

// Get my sales follow-ups (current employee's follow-ups)
export const getMySalesFollowUps = catchAsyncError(async (req, res, next) => {
  const {
    status,
    customerName,
    dateFrom,
    dateTo,
    page = 1,
    limit = 10
  } = req.query;

  const query = { createdBy: req.user.id };

  // Apply filters
  if (status) query.status = status;
  if (customerName) {
    query.customerName = { $regex: customerName, $options: 'i' };
  }
  if (dateFrom || dateTo) {
    query.callingDate = {};
    if (dateFrom) query.callingDate.$gte = new Date(dateFrom);
    if (dateTo) query.callingDate.$lte = new Date(dateTo);
  }

  const skip = (page - 1) * limit;

  const salesFollowUps = await SalesFollowUp.find(query)
    .populate('createdBy', 'empId employeeName email department')
    .populate('lastUpdatedBy', 'empId employeeName email department')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await SalesFollowUp.countDocuments(query);

  // Get current user details
  const currentUser = await Employee.findById(req.user.id).select('empId employeeName department');

  res.status(200).json({
    success: true,
    data: salesFollowUps,
    currentUser: {
      empId: currentUser.empId,
      employeeName: currentUser.employeeName,
      department: currentUser.department
    },
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  });
});

// Search sales follow-ups
export const searchSalesFollowUps = catchAsyncError(async (req, res, next) => {
  const { searchTerm, page = 1, limit = 10 } = req.query;

  if (!searchTerm) {
    return next(new ErrorHandler("Search term is required", 400));
  }

  const query = {
    $or: [
      { customerName: { $regex: searchTerm, $options: 'i' } },
      { contactPerson: { $regex: searchTerm, $options: 'i' } },
      { phone: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { address: { $regex: searchTerm, $options: 'i' } }
    ]
  };

  const skip = (page - 1) * limit;

  const salesFollowUps = await SalesFollowUp.find(query)
    .populate('createdBy', 'empId employeeName email department')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await SalesFollowUp.countDocuments(query);

  // Get current user details
  const currentUser = await Employee.findById(req.user.id).select('empId employeeName department');

  res.status(200).json({
    success: true,
    data: salesFollowUps,
    currentUser: {
      empId: currentUser.empId,
      employeeName: currentUser.employeeName,
      department: currentUser.department
    },
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  });
}); 