import { config } from 'dotenv';
config({ path: './config.env' });
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { connectDB } from './database/dbConnection.js';
import { errorMiddleware } from './middlewares/error.js';
import userRouter from './routes/userRouter.js';
import vehicleRouter from './routes/vehicleRouter.js';
import { removeUnverifiedAccounts } from './automation/removeUnverifiedAccount.js';
import { createDailyTargetsForAllEmployees, checkOverdueTargets } from './automation/createDailyTargets.js';
import loadRouter from './routes/loadRouter.js';
import bidRouter from './routes/bidRouter.js';
import loadBoardRouter from './routes/loadBoardRoutes.js';
import driverRouter from './routes/driverRoutes.js';
import shipperDriverRouter from './routes/shipper_driverRoutes.js';
import inhouseUserRouter from './routes/inhouseUserRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import breakRoutes from './routes/breakRoutes.js';
import { checkOverdueBreaks } from './controllers/breakController.js';
import moduleMasterRouter from './routes/moduleMasterRoutes.js';
import targetRouter from './routes/targetRoutes.js';
import leaveRouter from './routes/leaveRoutes.js';
import attendanceRouter from './routes/attendanceRoutes.js';
import emailRouter from './routes/emailRoutes.js';
import teamMemberRouter from './routes/teamMemberRoutes.js';
import hygieneRouter from './routes/hygieneRoutes.js';
import payrollRouter from './routes/payrollRoutes.js';
import analytics8x8Routes from './routes/analytics8x8Routes.js';
import dailyTaskRoutes from './routes/dailyTaskRoutes.js';
import emailInboxRoutes from './routes/emailInboxRoutes.js';
// import individualEmailRoutes from './routes/individualEmailRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import dayTargetRoutes from './routes/dayTargetRoutes.js';
import hrActivityRoutes from './routes/hrActivityRoutes.js';
import salesFollowUpRoutes from './routes/salesFollowUpRoutes.js';
import rateLimit from 'express-rate-limit';
import doRoutes from './routes/doRoutes.js';
import candidateRouter from './routes/candidateRoutes.js';
import videoInterviewRouter from './routes/videoInterviewRoutes.js';


export const app = express();

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);





const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://192.168.1.7:5173',
    'https://vpowersuperadmin.netlify.app',
    'https://fluffy-fenglisu-36edff.netlify.app',
    'https://vpower.netlify.app',
    'https://vpl-liveproject-1.onrender.com',
];



app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true); 
        } else {
            console.error("❌ CORS Blocked Origin:", origin);
            callback(new Error('❌ Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
}));




app.use(cookieParser());

// Serve static files
app.use(express.static('public'));

// Move express.json and express.urlencoded to the very top before any routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Move loadRouter before express.json and express.urlencoded for file upload compatibility
app.use('/api/v1/load', loadRouter);

// Rate Limiter Middleware
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increased global limit for more requests per IP
  message: {
    status: 429,
    error: 'Too many requests, please try again after 15 minutes.'
  }
});
app.use(globalLimiter); // Apply to all routes

// Stricter limiter for login and register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Only 15 requests per 15 min per IP
  message: {
    status: 429,
    error: 'Too many login/register attempts, please try again after 15 minutes.'
  }
});

// Place these before userRouter
app.use('/api/v1/user/login', authLimiter);
app.use('/api/v1/user/register', authLimiter);

// Friendly root route
app.get('/', (req, res) => {
  res.send('VPL Live Project API is running.');
});

app.use('/api/v1/user', userRouter);
app.use('/api/v1/vehicle', vehicleRouter);
app.use('/api/v1/bid', bidRouter);
app.use('/api/v1/loadboard', loadBoardRouter);
app.use('/api/v1/driver', driverRouter);
app.use('/api/v1/shipper_driver', shipperDriverRouter);
app.use('/api/v1/inhouseUser', inhouseUserRouter);
app.use('/api/v1/do', doRoutes);
app.use('/api/v1/break', breakRoutes);
app.use('/api/v1/module', moduleMasterRouter);
app.use('/api/v1/target', targetRouter);
app.use('/api/v1/leave', leaveRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/email', emailRouter);
app.use('/api/v1/team', teamMemberRouter);
app.use('/api/v1/hygiene', hygieneRouter);
app.use('/api/v1/hygiene/self', hygieneRouter);
app.use('/api/v1/payroll', payrollRouter);
app.use('/api/v1/analytics/8x8', analytics8x8Routes);
app.use('/api/v1/dailytask', dailyTaskRoutes);
app.use('/api/v1/email-inbox', emailInboxRoutes);
// app.use('/api/v1/individual-email', individualEmailRoutes);
app.use('/api/v1/meeting', meetingRoutes);
app.use('/api/v1/daytarget', dayTargetRoutes);
app.use('/api/v1/hr-activity', hrActivityRoutes);
app.use('/api/v1/sales-followup', salesFollowUpRoutes);
app.use('/api/v1/candidate', candidateRouter);
app.use('/api/v1/video-interview', videoInterviewRouter);
setInterval(checkOverdueBreaks, 60000);

// Daily target automation - run every day at 9 AM
setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 9 && now.getMinutes() === 0) {
    console.log('🔄 Running daily target automation...');
    await createDailyTargetsForAllEmployees();
    await checkOverdueTargets();
  }
}, 60000); // Check every minute


removeUnverifiedAccounts();
connectDB();

app.use(errorMiddleware);
