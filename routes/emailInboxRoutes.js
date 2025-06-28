import express from 'express';
const router = express.Router();
import { getInbox, getEmail, replyEmail, sendMail } from '../controllers/emailInboxController.js';
// const emailInboxController = require('../controllers/emailInboxController');

router.get('/inbox', getInbox);
router.get('/:id', getEmail);
router.post('/reply', replyEmail);
router.post('/send', sendMail);

export default router; 