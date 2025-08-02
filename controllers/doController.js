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
      
      // Calculate total amount automatically
      const calculatedTotal = customer.lineHaul + customer.fsc + customer.other;
      customer.totalAmount = calculatedTotal;
      console.log(`Customer ${i + 1} totalAmount calculated: ${calculatedTotal}`);
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
      
      // Validate that total matches quantity * amount
      const calculatedTotal = fee.quantity * fee.amount;
      console.log(`🔍 Fee ${i + 1} calculation: ${fee.quantity} × ${fee.amount} = ${calculatedTotal}`);
      
      if (Math.abs(calculatedTotal - fee.total) > 0.01) { // Allow for small floating point differences
        return res.status(400).json({ 
          success: false, 
          message: `Carrier fee item ${i + 1} total (${fee.total}) does not match quantity (${fee.quantity}) * amount (${fee.amount}) = ${calculatedTotal}` 
        });
      }
      
      // Add to total carrier fees
      totalCarrierFees += fee.total;
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
        
        // Calculate total amount automatically
        const calculatedTotal = customer.lineHaul + customer.fsc + customer.other;
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
        
        // Validate that total matches quantity * amount
        const calculatedTotal = fee.quantity * fee.amount;
        if (Math.abs(calculatedTotal - fee.total) > 0.01) { // Allow for small floating point differences
          return res.status(400).json({ 
            success: false, 
            message: `Carrier fee item ${i + 1} total (${fee.total}) does not match quantity (${fee.quantity}) * amount (${fee.amount}) = ${calculatedTotal}` 
          });
        }
        
        // Add to total carrier fees
        totalCarrierFees += fee.total;
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
            correctTotal += fee.quantity * fee.amount;
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