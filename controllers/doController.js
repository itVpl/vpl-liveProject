import DO from '../models/doModel.js';
import { getS3Url } from '../utils/s3Utils.js';

// 🔥 NEW: Function to generate automatic load number
const generateLoadNumber = async () => {
  try {
    let nextNumber = 1;
    
    // Get all DOs to find the highest load number
    const allDOs = await DO.find({}, 'customers.loadNo');
    
    const allLoadNumbers = [];
    
    allDOs.forEach(doItem => {
      if (doItem.customers && doItem.customers.length > 0) {
        doItem.customers.forEach(customer => {
          if (customer.loadNo && customer.loadNo.startsWith('L')) {
            const numberPart = customer.loadNo.substring(1);
            const num = parseInt(numberPart);
            if (!isNaN(num)) {
              allLoadNumbers.push(num);
            }
          }
        });
      }
    });
    
    if (allLoadNumbers.length > 0) {
      nextNumber = Math.max(...allLoadNumbers) + 1;
    }
    
    // Format: L0001, L0002, etc.
    return `L${nextNumber.toString().padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generating load number:', error);
    // Fallback: use timestamp if error occurs
    return `L${Date.now().toString().slice(-4)}`;
  }
};

// Create a new DO (Order)
export const createDO = async (req, res) => {
  try {
    const doData = req.body;
    const uploadedFile = req.file;
    
    // Debug: Log the received data
    console.log('Received DO data:', JSON.stringify(doData, null, 2));
    console.log('Uploaded file:', uploadedFile);
    
    // Parse JSON strings from form-data
    if (typeof doData.customers === 'string') {
      try {
        doData.customers = JSON.parse(doData.customers);
        console.log('Parsed customers:', doData.customers);
      } catch (error) {
        console.error('Error parsing customers JSON:', error);
        return res.status(400).json({ success: false, message: 'Invalid customers JSON format' });
      }
    }
    
    if (typeof doData.carrier === 'string') {
      try {
        doData.carrier = JSON.parse(doData.carrier);
        console.log('Parsed carrier:', doData.carrier);
      } catch (error) {
        console.error('Error parsing carrier JSON:', error);
        return res.status(400).json({ success: false, message: 'Invalid carrier JSON format' });
      }
    }
    
    if (typeof doData.shipper === 'string') {
      try {
        doData.shipper = JSON.parse(doData.shipper);
        console.log('Parsed shipper:', doData.shipper);
      } catch (error) {
        console.error('Error parsing shipper JSON:', error);
        return res.status(400).json({ success: false, message: 'Invalid shipper JSON format' });
      }
    }
    
    // Validate required fields
    if (!doData.empId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }
    
    if (!doData.customers || !Array.isArray(doData.customers) || doData.customers.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one customer is required' });
    }
    
    if (!doData.carrier) {
      return res.status(400).json({ success: false, message: 'Carrier information is required' });
    }
    
    if (!doData.shipper) {
      return res.status(400).json({ success: false, message: 'Shipper information is required' });
    }
    
    // Add createdBySalesUser information
    doData.createdBySalesUser = {
      empId: doData.empId,
      employeeName: req.user ? req.user.employeeName : 'Unknown',
      department: 'Sales'
    };
    
    // 🔥 NEW: Generate automatic load numbers for each customer
    for (let i = 0; i < doData.customers.length; i++) {
      const customer = doData.customers[i];
      console.log(`Processing customer ${i + 1}:`, JSON.stringify(customer, null, 2));
      
      // Generate automatic load number if not provided
      if (!customer.loadNo || customer.loadNo.trim() === '') {
        const generatedLoadNo = await generateLoadNumber();
        customer.loadNo = generatedLoadNo;
        console.log(`Generated load number for customer ${i + 1}: ${generatedLoadNo}`);
      }
      
      // Check each field individually
      if (!customer.billTo) {
        return res.status(400).json({ 
          success: false, 
          message: `Customer ${i + 1} is missing billTo field` 
        });
      }
      if (!customer.dispatcherName) {
        return res.status(400).json({ 
          success: false, 
          message: `Customer ${i + 1} is missing dispatcherName field` 
        });
      }
      if (!customer.workOrderNo) {
        return res.status(400).json({ 
          success: false, 
          message: `Customer ${i + 1} is missing workOrderNo field` 
        });
      }
      if (!customer.lineHaul) {
        return res.status(400).json({ 
          success: false, 
          message: `Customer ${i + 1} is missing lineHaul field` 
        });
      }
      if (!customer.fsc) {
        return res.status(400).json({ 
          success: false, 
          message: `Customer ${i + 1} is missing fsc field` 
        });
      }
      if (!customer.other) {
        return res.status(400).json({ 
          success: false, 
          message: `Customer ${i + 1} is missing other field` 
        });
      }
      
      // Calculate total amount automatically - ensure values are numbers
      const lineHaul = Number(customer.lineHaul);
      const fsc = Number(customer.fsc);
      const other = Number(customer.other);
      const calculatedTotal = lineHaul + fsc + other;
      customer.totalAmount = calculatedTotal;
      console.log(`Customer ${i + 1} totalAmount calculated: ${lineHaul} + ${fsc} + ${other} = ${calculatedTotal}`);
    }
    
    // Validate carrier data
    if (!doData.carrier.carrierName || !doData.carrier.equipmentType) {
      return res.status(400).json({ success: false, message: 'Carrier name and equipment type are required' });
    }
    
    // Validate carrier fees
    if (!doData.carrier.carrierFees || !Array.isArray(doData.carrier.carrierFees)) {
      return res.status(400).json({ success: false, message: 'Carrier fees must be an array' });
    }
    
    // Validate each carrier fee item and calculate total
    let totalCarrierFees = 0;
    console.log('🔍 Calculating total carrier fees...');
    
    for (let i = 0; i < doData.carrier.carrierFees.length; i++) {
      const fee = doData.carrier.carrierFees[i];
      console.log(`🔍 Fee ${i + 1}:`, fee);
      
      if (!fee.name || !fee.quantity || !fee.amount || !fee.total) {
        return res.status(400).json({ 
          success: false, 
          message: `Carrier fee item ${i + 1} is missing required fields (name, quantity, amount, total)` 
        });
      }
      
      // Ensure all values are numbers, not strings
      const quantity = Number(fee.quantity);
      const amount = Number(fee.amount);
      const total = Number(fee.total);
      
      // Validate that total matches quantity * amount
      const calculatedTotal = quantity * amount;
      console.log(`🔍 Fee ${i + 1} calculation: ${quantity} × ${amount} = ${calculatedTotal}`);
      
      if (Math.abs(calculatedTotal - total) > 0.01) { // Allow for small floating point differences
        return res.status(400).json({ 
          success: false, 
          message: `Carrier fee item ${i + 1} total (${total}) does not match quantity (${quantity}) * amount (${amount}) = ${calculatedTotal}` 
        });
      }
      
      // Add to total carrier fees (ensure it's a number)
      totalCarrierFees += total;
      console.log(`🔍 Running total: ${totalCarrierFees}`);
    }
    
    // Add total carrier fees to the carrier object
    doData.carrier.totalCarrierFees = totalCarrierFees;
    
    console.log('✅ Final totalCarrierFees:', totalCarrierFees);
    console.log('Carrier fees:', doData.carrier.carrierFees);
    
    // Handle uploaded file if present
    if (uploadedFile) {
      const fileUrl = uploadedFile.location || uploadedFile.path; // S3 URL or local path
      const s3Url = uploadedFile.location ? uploadedFile.location : getS3Url(uploadedFile.path);
      
      doData.uploadedFiles = [{
        fileName: uploadedFile.originalname,
        fileUrl: s3Url,
        fileType: 'document',
        uploadDate: new Date()
      }];
    }
    
    // Validate shipper data
    if (!doData.shipper.name || !doData.shipper.pickUpDate || !doData.shipper.containerNo || 
        !doData.shipper.containerType || !doData.shipper.weight || !doData.shipper.dropDate) {
      return res.status(400).json({ success: false, message: 'Shipper information is incomplete' });
    }
    
    // Validate pickup and drop locations
    if (!doData.shipper.pickUpLocations || !Array.isArray(doData.shipper.pickUpLocations) || 
        doData.shipper.pickUpLocations.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one pickup location is required' });
    }
    
    if (!doData.shipper.dropLocations || !Array.isArray(doData.shipper.dropLocations) || 
        doData.shipper.dropLocations.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one drop location is required' });
    }
    
    const newDO = await DO.create(doData);
    res.status(201).json({ success: true, data: newDO });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get DOs by Employee ID
export const getDOByEmpId = async (req, res) => {
  try {
    const { empId } = req.params;
    const dos = await DO.find({ empId: empId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: dos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all DOs
export const getAllDO = async (req, res) => {
  try {
    const dos = await DO.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: dos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get DOs by date (YYYY-MM-DD)
export const getDOByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required in query params.' });
    }
    const start = new Date(date);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    const dos = await DO.find({ date: { $gte: start, $lte: end } }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: dos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get DOs by date range (startDate, endDate as YYYY-MM-DD)
export const getDOByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required in query params.' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const dos = await DO.find({ date: { $gte: start, $lte: end } }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: dos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update DO
export const updateDO = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Validate the update data similar to create
    if (updateData.customers) {
      for (let i = 0; i < updateData.customers.length; i++) {
        const customer = updateData.customers[i];
        if (!customer.loadNo || !customer.billTo || !customer.dispatcherName || 
            !customer.workOrderNo || !customer.lineHaul || !customer.fsc || 
            !customer.other) {
          return res.status(400).json({ 
            success: false, 
            message: `Customer ${i + 1} is missing required fields` 
          });
        }
        
        // Calculate total amount automatically - ensure values are numbers
        const lineHaul = Number(customer.lineHaul);
        const fsc = Number(customer.fsc);
        const other = Number(customer.other);
        const calculatedTotal = lineHaul + fsc + other;
        customer.totalAmount = calculatedTotal;
      }
    }
    
    // Validate carrier fees if provided in update
    if (updateData.carrier && updateData.carrier.carrierFees) {
      if (!Array.isArray(updateData.carrier.carrierFees)) {
        return res.status(400).json({ success: false, message: 'Carrier fees must be an array' });
      }
      
      // Validate each carrier fee item and calculate total
      let totalCarrierFees = 0;
      for (let i = 0; i < updateData.carrier.carrierFees.length; i++) {
        const fee = updateData.carrier.carrierFees[i];
        if (!fee.name || !fee.quantity || !fee.amount || !fee.total) {
          return res.status(400).json({ 
            success: false, 
            message: `Carrier fee item ${i + 1} is missing required fields (name, quantity, amount, total)` 
          });
        }
        
        // Ensure all values are numbers, not strings
        const quantity = Number(fee.quantity);
        const amount = Number(fee.amount);
        const total = Number(fee.total);
        
        // Validate that total matches quantity * amount
        const calculatedTotal = quantity * amount;
        if (Math.abs(calculatedTotal - total) > 0.01) { // Allow for small floating point differences
          return res.status(400).json({ 
            success: false, 
            message: `Carrier fee item ${i + 1} total (${total}) does not match quantity (${quantity}) * amount (${amount}) = ${calculatedTotal}` 
          });
        }
        
        // Add to total carrier fees (ensure it's a number)
        totalCarrierFees += total;
      }
      
      // Add total carrier fees to the carrier object
      updateData.carrier.totalCarrierFees = totalCarrierFees;
    }
    
    const updatedDO = await DO.findByIdAndUpdate(
      id, 
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    if (!updatedDO) {
      return res.status(404).json({ success: false, message: 'DO not found' });
    }
    
    res.status(200).json({ success: true, data: updatedDO });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete DO
export const deleteDO = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedDO = await DO.findByIdAndDelete(id);
    
    if (!deletedDO) {
      return res.status(404).json({ success: false, message: 'DO not found' });
    }
    
    res.status(200).json({ success: true, message: 'DO deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get DO by ID
export const getDOById = async (req, res) => {
  try {
    const { id } = req.params;
    const doData = await DO.findById(id);
    
    if (!doData) {
      return res.status(404).json({ success: false, message: 'DO not found' });
    }
    
    res.status(200).json({ success: true, data: doData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload files for DO
export const uploadDOFiles = async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;
    
    // Check if DO exists
    const doData = await DO.findById(id);
    if (!doData) {
      return res.status(404).json({ success: false, message: 'DO not found' });
    }
    
    // Get the first customer's load number for folder structure
    const loadNo = doData.customers && doData.customers.length > 0 ? doData.customers[0].loadNo : 'unknown';
    
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    
    const uploadedFiles = [];
    
    // Process each file type
    for (const [fieldName, fileArray] of Object.entries(files)) {
      for (const file of fileArray) {
        const fileUrl = file.location || file.path; // S3 URL or local path
        const s3Url = file.location ? file.location : getS3Url(file.path);
        
        uploadedFiles.push({
          fileName: file.originalname,
          fileUrl: s3Url,
          fileType: fieldName,
          uploadDate: new Date()
        });
      }
    }
    
    // Add uploaded files to DO
    doData.uploadedFiles = [...(doData.uploadedFiles || []), ...uploadedFiles];
    await doData.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Files uploaded successfully',
      data: {
        uploadedFiles,
        totalFiles: doData.uploadedFiles.length
      }
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get files for DO
export const getDOFiles = async (req, res) => {
  try {
    const { id } = req.params;
    const doData = await DO.findById(id);
    
    if (!doData) {
      return res.status(404).json({ success: false, message: 'DO not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      data: {
        files: doData.uploadedFiles || [],
        totalFiles: (doData.uploadedFiles || []).length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Fix existing DO records with incorrect totalCarrierFees
export const fixCarrierFees = async (req, res) => {
  try {
    const allDOs = await DO.find({});
    let fixedCount = 0;
    
    for (const doRecord of allDOs) {
      if (doRecord.carrier && doRecord.carrier.carrierFees) {
        let correctTotal = 0;
        
        for (const fee of doRecord.carrier.carrierFees) {
          if (fee.quantity && fee.amount) {
            const quantity = Number(fee.quantity);
            const amount = Number(fee.amount);
            correctTotal += quantity * amount;
          }
        }
        
        if (doRecord.carrier.totalCarrierFees !== correctTotal) {
          console.log(`🔧 Fixing DO ${doRecord._id}: ${doRecord.carrier.totalCarrierFees} → ${correctTotal}`);
          doRecord.carrier.totalCarrierFees = correctTotal;
          await doRecord.save();
          fixedCount++;
        }
      }
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Fixed ${fixedCount} DO records with incorrect carrier fees`,
      fixedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}; 

// 🔥 NEW: Get available CMT users for assignment
export const getAvailableCMTUsers = async (req, res) => {
  try {
    // ✅ 1. Check if user is authenticated and is a sales employee
    if (!req.user || !req.user.empId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // ✅ 2. Check if user belongs to Sales department
    if (req.user.department !== 'Sales') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Sales department employees can access CMT users' 
      });
    }

    // ✅ 3. Get all active CMT department employees
    const { Employee } = await import('../models/inhouseUserModel.js');
    const cmtUsers = await Employee.find({
      department: 'CMT',
      status: 'active'
    }).select('empId employeeName designation email mobileNo');

    // ✅ 4. Success response
    res.status(200).json({
      success: true,
      message: 'Available CMT users retrieved successfully',
      data: {
        totalUsers: cmtUsers.length,
        users: cmtUsers
      }
    });

  } catch (err) {
    console.error('❌ Error getting available CMT users:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// 🔥 NEW: Assign delivery order to CMT user
export const assignDOToCMT = async (req, res) => {
  try {
    // ✅ 1. Check if user is authenticated and is a sales employee
    if (!req.user || !req.user.empId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // ✅ 2. Check if user belongs to Sales department
    if (req.user.department !== 'Sales') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Sales department employees can assign delivery orders' 
      });
    }

    // ✅ 3. Get DO ID and CMT user ID from request
    const { doId, cmtUserId } = req.body;

    if (!doId) {
      return res.status(400).json({
        success: false,
        message: 'DO ID is required'
      });
    }

    if (!cmtUserId) {
      return res.status(400).json({
        success: false,
        message: 'CMT User ID is required'
      });
    }

    // ✅ 4. Find the delivery order
    const doRecord = await DO.findById(doId);
    if (!doRecord) {
      return res.status(404).json({
        success: false,
        message: 'Delivery order not found'
      });
    }

    // ✅ 5. Verify that the DO was created by this sales user (or allow admin/superadmin)
    if (doRecord.createdBySalesUser.empId !== req.user.empId && 
        req.user.role !== 'admin' && 
        req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'You can only assign delivery orders created by yourself'
      });
    }

    // ✅ 6. Verify that the CMT user exists and is active
    const { Employee } = await import('../models/inhouseUserModel.js');
    const cmtUser = await Employee.findOne({
      empId: cmtUserId,
      department: 'CMT',
      status: 'active'
    });

    if (!cmtUser) {
      return res.status(404).json({
        success: false,
        message: 'CMT user not found or not active'
      });
    }

    // ✅ 7. Update the delivery order with assignment
    doRecord.assignedToCMT = {
      empId: cmtUser.empId,
      employeeName: cmtUser.employeeName,
      department: 'CMT',
      assignedAt: new Date(),
      assignedBy: {
        empId: req.user.empId,
        employeeName: req.user.employeeName,
        department: 'Sales'
      }
    };
    doRecord.assignmentStatus = 'assigned';

    await doRecord.save();

    // ✅ 8. Success response
    res.status(200).json({
      success: true,
      message: 'Delivery order assigned to CMT user successfully',
      data: {
        doId: doRecord._id,
        assignedTo: {
          empId: cmtUser.empId,
          employeeName: cmtUser.employeeName,
          department: 'CMT'
        },
        assignedAt: doRecord.assignedToCMT.assignedAt,
        assignedBy: {
          empId: req.user.empId,
          employeeName: req.user.employeeName,
          department: 'Sales'
        },
        assignmentStatus: doRecord.assignmentStatus
      }
    });

  } catch (err) {
    console.error('❌ Error assigning DO to CMT:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// 🔥 NEW: Get delivery orders assigned to a CMT user
export const getDOsAssignedToCMT = async (req, res) => {
  try {
    // ✅ 1. Check if user is authenticated
    if (!req.user || !req.user.empId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // ✅ 2. Check if user belongs to CMT department
    if (req.user.department !== 'CMT') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only CMT department employees can access assigned delivery orders' 
      });
    }

    // ✅ 3. Get query parameters
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'assignedToCMT.assignedAt',
      sortOrder = 'desc'
    } = req.query;

    // ✅ 4. Build filter to find DOs assigned to this CMT user
    const filter = {
      'assignedToCMT.empId': req.user.empId
    };

    // Apply additional filters
    if (status) {
      filter.assignmentStatus = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // ✅ 5. Find DOs with populated information
    const dos = await DO.find(filter)
      .populate('createdBySalesUser', 'empId employeeName department')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await DO.countDocuments(filter);

    // ✅ 6. Get statistics for this CMT user
    const totalAssigned = await DO.countDocuments({ 'assignedToCMT.empId': req.user.empId });
    const totalCompleted = await DO.countDocuments({ 
      'assignedToCMT.empId': req.user.empId,
      assignmentStatus: 'completed'
    });
    const totalInProgress = await DO.countDocuments({ 
      'assignedToCMT.empId': req.user.empId,
      assignmentStatus: 'in_progress'
    });

    // ✅ 7. Success response
    res.status(200).json({
      success: true,
      message: 'Assigned delivery orders retrieved successfully',
      data: {
        dos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        statistics: {
          totalAssigned,
          totalCompleted,
          totalInProgress,
          totalPending: totalAssigned - totalCompleted - totalInProgress
        }
      }
    });

  } catch (err) {
    console.error('❌ Error getting DOs assigned to CMT:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// 🔥 NEW: Update assignment status (for CMT users to mark progress)
export const updateAssignmentStatus = async (req, res) => {
  try {
    // ✅ 1. Check if user is authenticated
    if (!req.user || !req.user.empId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // ✅ 2. Check if user belongs to CMT department
    if (req.user.department !== 'CMT') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only CMT department employees can update assignment status' 
      });
    }

    // ✅ 3. Get DO ID and new status from request
    const { doId, status } = req.body;

    if (!doId) {
      return res.status(400).json({
        success: false,
        message: 'DO ID is required'
      });
    }

    if (!status || !['assigned', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (assigned, in_progress, completed)'
      });
    }

    // ✅ 4. Find the delivery order
    const doRecord = await DO.findById(doId);
    if (!doRecord) {
      return res.status(404).json({
        success: false,
        message: 'Delivery order not found'
      });
    }

    // ✅ 5. Verify that the DO is assigned to this CMT user
    if (doRecord.assignedToCMT.empId !== req.user.empId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update status for delivery orders assigned to you'
      });
    }

    // ✅ 6. Update the assignment status
    doRecord.assignmentStatus = status;
    await doRecord.save();

    // ✅ 7. Success response
    res.status(200).json({
      success: true,
      message: 'Assignment status updated successfully',
      data: {
        doId: doRecord._id,
        newStatus: status,
        updatedAt: doRecord.updatedAt
      }
    });

  } catch (err) {
    console.error('❌ Error updating assignment status:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// 🔥 NEW: Get delivery orders created by sales user (with assignment info)
export const getDOsCreatedBySalesUser = async (req, res) => {
  try {
    // ✅ 1. Check if user is authenticated and is a sales employee
    if (!req.user || !req.user.empId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // ✅ 2. Check if user belongs to Sales department
    if (req.user.department !== 'Sales') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only Sales department employees can access this data' 
      });
    }

    // ✅ 3. Get query parameters
    const {
      page = 1,
      limit = 10,
      assignmentStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // ✅ 4. Build filter to find DOs created by this sales user
    const filter = {
      'createdBySalesUser.empId': req.user.empId
    };

    // Apply additional filters
    if (assignmentStatus) {
      filter.assignmentStatus = assignmentStatus;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // ✅ 5. Find DOs with populated assignment information
    const dos = await DO.find(filter)
      .populate('assignedToCMT', 'empId employeeName department')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await DO.countDocuments(filter);

    // ✅ 6. Get statistics for this sales user
    const totalCreated = await DO.countDocuments({ 'createdBySalesUser.empId': req.user.empId });
    const totalAssigned = await DO.countDocuments({ 
      'createdBySalesUser.empId': req.user.empId,
      assignmentStatus: { $in: ['assigned', 'in_progress', 'completed'] }
    });
    const totalUnassigned = await DO.countDocuments({ 
      'createdBySalesUser.empId': req.user.empId,
      assignmentStatus: 'unassigned'
    });

    // ✅ 7. Success response
    res.status(200).json({
      success: true,
      message: 'Delivery orders created by sales user retrieved successfully',
      data: {
        dos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        statistics: {
          totalCreated,
          totalAssigned,
          totalUnassigned
        }
      }
    });

  } catch (err) {
    console.error('❌ Error getting DOs created by sales user:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
}; 