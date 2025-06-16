import express from 'express';
import { startBreak, endBreak } from '../controllers/breakController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';

const router = express.Router();

router.post('/start', isAuthenticatedEmployee, startBreak);
router.post('/end', isAuthenticatedEmployee, endBreak);

export default router;