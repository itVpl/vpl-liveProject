// import express from 'express';
// import { sendMessage, getChat, getChatList, markAsSeen, searchEmployeesForChat } from '../controllers/chatController.js';
// import { isAuthenticatedEmployee } from '../middlewares/auth.js';

// const router = express.Router();

// // Send message: expects { receiverEmpId, message }
// router.post('/send', isAuthenticatedEmployee, sendMessage);
// // Get chat with another user by empId
// router.get('/with/:empId', isAuthenticatedEmployee, getChat);
// router.get('/list', isAuthenticatedEmployee, getChatList);
// router.patch('/seen/:empId', isAuthenticatedEmployee, markAsSeen);
// router.get('/search-users', isAuthenticatedEmployee, searchEmployeesForChat);

// export default router; 


// chatRoutes.js
import express from 'express';
import {
  getChat,
  getChatList,
  markAsSeen,
  searchEmployeesForChat,
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

  return router;
}