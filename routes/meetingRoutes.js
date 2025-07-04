import express from 'express';
import { startMeeting, endMeeting } from '../controllers/meetingController.js';
import { isAuthenticatedUser } from '../middlewares/auth.js';

const router = express.Router();

router.post('/start', startMeeting);
router.post('/end', endMeeting);

export default router; 