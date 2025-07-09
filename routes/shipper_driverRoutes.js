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
  getAllUsersWithEmployeeInfo
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

export default router;
