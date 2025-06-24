import express from 'express';
import { getCallRecords } from '../controllers/analytics8x8Controller.js';

const router = express.Router();

router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '8x8 Analytics API is working!',
    timestamp: new Date().toISOString()
  });
});

router.get('/call-records', getCallRecords);

export default router;
