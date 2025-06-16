import express from 'express';
import { addModule, getAllModules } from '../controllers/moduleMasterController.js';
import { isSuperAdmin } from '../middlewares/isSuperAdmin.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
const router = express.Router();

router.post('/', isAuthenticatedEmployee, isSuperAdmin, addModule);       // Add a module
router.get('/', isAuthenticatedEmployee, isSuperAdmin, getAllModules);    // Get all active modules

export default router;
