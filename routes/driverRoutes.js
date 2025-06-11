import express from 'express';
import { registerDriver, loginDriver, getAllDrivers, getDriverById, updateDriver, deleteDriver } from '../controllers/driverController.js';
const driverRouter = express.Router();
driverRouter.post('/register', registerDriver);
driverRouter.post('/login', loginDriver);
driverRouter.get('/all', getAllDrivers);
driverRouter.get('/:id', getDriverById);
driverRouter.put('/:id', updateDriver);
driverRouter.delete('/:id', deleteDriver);

export default driverRouter;