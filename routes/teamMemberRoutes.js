import express from 'express';
import { getTeamMembers } from '../controllers/teamController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', isAuthenticatedEmployee, getTeamMembers);

export default router;
