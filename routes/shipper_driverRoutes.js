import express from 'express';
import { shipperTruckerUpload } from '../middlewares/upload.js';
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
  getTodayTruckerCount
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
router.post('/cmt/add-trucker', isAuthenticatedEmployee, shipperTruckerUpload.single('docUpload'), addTruckerByCMTEmployee);

// 🔥 NEW: Get Trucker details by CMT Employee's empId
router.get('/cmt/truckers', isAuthenticatedEmployee, getTruckersByCMTEmployee); // Get current user's truckers
router.get('/cmt/truckers/:empId', isAuthenticatedEmployee, getTruckersByCMTEmployee); // Get specific employee's truckers

// 🔥 NEW: Get Today's Trucker Count by CMT Employee
router.get('/cmt/today-count', isAuthenticatedEmployee, getTodayTruckerCount); // Get current user's today count
router.get('/cmt/today-count/:empId', isAuthenticatedEmployee, getTodayTruckerCount); // Get specific employee's today count

export default router;
