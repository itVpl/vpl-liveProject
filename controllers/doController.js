import DO from '../models/doModel.js';

// Create a new DO (Order)
export const createDO = async (req, res) => {
  try {
    const doData = req.body;
    
    // Debug: Log the received data
    console.log('Received DO data:', JSON.stringify(doData, null, 2));
    
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
    
    // Validate customer data
    for (let i = 0; i < doData.customers.length; i++) {
      const customer = doData.customers[i];
      console.log(`Validating customer ${i + 1}:`, JSON.stringify(customer, null, 2));
      
      // Check each field individually
      if (!customer.loadNo) {
        return res.status(400).json({ 
          success: false, 
          message: `Customer ${i + 1} is missing loadNo field` 
        });
      }
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
    if (!doData.carrier.carrierName || !doData.carrier.equipmentType || !doData.carrier.carrierFees) {
      return res.status(400).json({ success: false, message: 'Carrier information is incomplete' });
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