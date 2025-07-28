
// export default router; 


// chatRoutes.js
import express from 'express';
import {
  getChat,
  getChatList,
  markAsSeen,
  searchEmployeesForChat,
  getUserChatFiles,
  getChatFiles,
} from '../controllers/chatController.js';
import { isAuthenticatedEmployee } from '../middlewares/auth.js';
import { sendMessage } from '../controllers/chatController.js';
import { chatFileUpload } from '../middlewares/upload.js';

export default function(io) {
  const router = express.Router();

  // Pass `io` to sendMessage
  router.post('/send', isAuthenticatedEmployee, chatFileUpload.single('file'), sendMessage(io));
  router.get('/with/:empId', isAuthenticatedEmployee, getChat);
  router.get('/list', isAuthenticatedEmployee, getChatList);
  router.patch('/seen/:empId', isAuthenticatedEmployee, markAsSeen);
  router.get('/search-users', isAuthenticatedEmployee, searchEmployeesForChat);
  
  // File management routes
  router.get('/files/user/:empId', isAuthenticatedEmployee, getUserChatFiles);
  router.get('/files/chat/:empId', isAuthenticatedEmployee, getChatFiles);

  return router;
}