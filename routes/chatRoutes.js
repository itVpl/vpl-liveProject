import express from 'express';
import { sendMessage, getChat, getChatList, markAsSeen } from '../controllers/chatController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';

const router = express.Router();

// Send message: expects { receiverEmpId, message }
router.post('/send', isAuthenticatedEmployee, sendMessage);
// Get chat with another user by empId
router.get('/with/:empId', isAuthenticatedEmployee, getChat);
router.get('/list', isAuthenticatedEmployee, getChatList);
router.patch('/seen/:empId', isAuthenticatedEmployee, markAsSeen);

export default router; 