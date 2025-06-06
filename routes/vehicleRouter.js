import express from 'express';
import { getVehicleByNumber } from '../controllers/vehicleController.js';

const vehicleRouter = express.Router();

vehicleRouter.get('/vehicle', getVehicleByNumber);

export default vehicleRouter; 