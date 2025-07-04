import express from 'express';
import { sendMessage, getChat, getChatList, markAsSeen, searchEmployeesForChat } from '../controllers/chatController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';

const router = express.Router();

// Send message: expects { receiverEmpId, message }
router.post('/send', isAuthenticatedEmployee, sendMessage);
// Get chat with another user by empId
router.get('/with/:empId', isAuthenticatedEmployee, getChat);
router.get('/list', isAuthenticatedEmployee, getChatList);
router.patch('/seen/:empId', isAuthenticatedEmployee, markAsSeen);
router.get('/search-users', isAuthenticatedEmployee, searchEmployeesForChat);

export default router; 