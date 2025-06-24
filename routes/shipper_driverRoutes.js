import express from 'express';
import { shipperTruckerUpload } from '../middlewares/upload.js';
import { 
  registerUser, 
  getAllUsers, 
  getAllShippers,   
  getAllTruckers, 
  loginUser,    
  simpleStatusUpdate
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





export default router;
