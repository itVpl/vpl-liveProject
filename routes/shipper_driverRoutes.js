import express from 'express';
import upload from '../middlewares/upload.js';
import { registerUser, getAllUsers, getAllShippers, getAllTruckers } from '../controllers/shipper_driverController.js';

const router = express.Router();

router.post('/register', upload.single('docUpload'), registerUser);
router.get('/', getAllUsers);
router.get('/shippers', getAllShippers);
router.get('/truckers', getAllTruckers);
export default router;
