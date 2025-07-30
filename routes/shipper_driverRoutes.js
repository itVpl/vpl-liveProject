import express from 'express';
import { shipperTruckerUpload, cmtDocumentUpload } from '../middlewares/upload.js';
import { 
  registerUser, 
  getAllUsers, 
  getAllShippers,   
  getAllTruckers, 
  loginUser,    
  simpleStatusUpdate,
  addShipperTruckerByEmployee,
  getShipperTruckersByEmployee,
  getAllUsersWithEmployeeInfo,
  addTruckerByCMTEmployee,
  getTruckersByCMTEmployee,
  getTodayTruckerCount,
  addCustomerByDepartmentEmployee,
  getCustomersByDepartmentEmployee,
  getTodayCustomerCount,
  approveByAccountant,
  approveByManager,
  rejectTrucker,
  getAllTruckersSimple,
  assignUsersToCustomer,
  getAssignedUsersForCustomer
} from '../controllers/shipper_driverController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
router.post('/register', shipperTruckerUpload.single('docUpload'), registerUser);
router.post('/login', loginUser);

// General routes
router.get('/', getAllUsers);
router.get('/shippers', getAllShippers);
router.get('/truckers', getAllTruckers);

router.patch('/simple-status/:userId', simpleStatusUpdate);

// 🔥 New: Employee routes (require authentication)
router.post('/employee/add', isAuthenticatedEmployee, shipperTruckerUpload.single('docUpload'), addShipperTruckerByEmployee);
router.get('/employee/my-additions', isAuthenticatedEmployee, (req, res) => {
    // Redirect to get shippers/truckers added by current employee
    req.params.empId = req.user.empId;
    return getShipperTruckersByEmployee(req, res);
});
router.get('/employee/additions/:empId', isAuthenticatedEmployee, getShipperTruckersByEmployee);
router.get('/employee/all-with-info', isAuthenticatedEmployee, getAllUsersWithEmployeeInfo);

// 🔥 NEW: CMT Department Employee can add Trucker only
router.post('/cmt/add-trucker', isAuthenticatedEmployee, cmtDocumentUpload, addTruckerByCMTEmployee);

// 🔥 NEW: Get Trucker details by CMT Employee's empId
router.get('/cmt/truckers', isAuthenticatedEmployee, getTruckersByCMTEmployee); // Get current user's truckers
router.get('/cmt/truckers/:empId', isAuthenticatedEmployee, getTruckersByCMTEmployee); // Get specific employee's truckers

// 🔥 NEW: Get Today's Trucker Count by CMT Employee
router.get('/cmt/today-count', isAuthenticatedEmployee, getTodayTruckerCount); // Get current user's today count
router.get('/cmt/today-count/:empId', isAuthenticatedEmployee, getTodayTruckerCount); // Get specific employee's today count

// 🔥 NEW: Test route to check request body
router.post('/department/test', isAuthenticatedEmployee, (req, res) => {
    console.log('🔍 Test route - Request body:', req.body);
    console.log('🔍 Test route - Request headers:', req.headers);
    res.json({
        success: true,
        body: req.body,
        headers: req.headers
    });
});




// 🔥 NEW: Department-based customer addition (CMT=Trucker, Sales=Shipper)
router.post('/department/add-customer', isAuthenticatedEmployee, cmtDocumentUpload, addCustomerByDepartmentEmployee);

// 🔥 NEW: Enhanced CMT customer addition with multiple documents
router.post('/cmt/add-customer-with-documents', isAuthenticatedEmployee, cmtDocumentUpload, addCustomerByDepartmentEmployee);

// 🔥 NEW: Get customers by department employee
router.get('/department/customers', isAuthenticatedEmployee, getCustomersByDepartmentEmployee); // Get current user's customers
router.get('/department/customers/:empId', isAuthenticatedEmployee, getCustomersByDepartmentEmployee); // Get specific employee's customers

// 🔥 NEW: Assign users to customer (POST and PUT both supported)
router.post('/customer/assign-users', isAuthenticatedEmployee, assignUsersToCustomer);
router.put('/customer/assign-users', isAuthenticatedEmployee, assignUsersToCustomer);

// 🔥 NEW: Get assigned users for a customer
router.get('/customer/:customerId/assigned-users', isAuthenticatedEmployee, getAssignedUsersForCustomer);

// 🔥 NEW: Get Today's Customer Count by Department Employee
router.get('/department/today-count', isAuthenticatedEmployee, getTodayCustomerCount); // Get current user's today count
router.get('/department/today-count/:empId', isAuthenticatedEmployee, getTodayCustomerCount); // Get specific employee's today count

// 🔥 NEW: Approval Routes for CMT Truckers (No Authentication Required)
// Accountant Approval
router.patch('/approval/accountant/:truckerId', approveByAccountant);

// Manager Approval
router.patch('/approval/manager/:truckerId', approveByManager);

// Reject Trucker (Accountant or Manager)
router.patch('/approval/reject/:truckerId', rejectTrucker);

// 🔥 NEW: Get all truckers (simple API - no authentication required)
router.get('/all-truckers', getAllTruckersSimple);

export default router;
