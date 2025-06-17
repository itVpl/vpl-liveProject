import express from 'express';
import { addModule, getAllModules } from '../controllers/moduleMasterController.js';
import { isSuperAdmin } from '../middlewares/isSuperAdmin.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import { deactivateModule } from '../controllers/moduleMasterController.js';
const router = express.Router();

router.post('/', isAuthenticatedEmployee, isSuperAdmin, addModule);       
router.get('/', isAuthenticatedEmployee, isSuperAdmin, getAllModules);    
router.patch('/deactivate/:id', isAuthenticatedEmployee, isSuperAdmin, deactivateModule);

export default router;
