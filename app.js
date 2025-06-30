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
import chatRoutes from './routes/chatRoutes.js';

export const app = express();

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

// const allowedOrigins = [
//     process.env.CLIENT_URL,
//     "http://192.168.1.7:5173",  
//     "https://vpl-liveproject-1.onrender.com",
//     "https://vpowersuperadmin.netlify.app",
//     "http://localhost:5173"
// ];

const allowedOrigins = [
  ...(process.env.CLIENT_URL?.split(',') || []),
  "http://192.168.1.7:5173",
  "https://vpl-liveproject-1.onrender.com",
  "https://vpowersuperadmin.netlify.app",
  "http://localhost:5173"
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
}));




// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin) return callback(null, true); // allow server-to-server or Postman

//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     } else {
//       return callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   optionsSuccessStatus: 200

// }));




// app.options('/*', cors());


// app.use(cors({
//     origin: process.env.CLIENT_URL,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//     credentials: true,
// }));

app.use(cookieParser());

// Move express.json and express.urlencoded to the very top before any routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Move loadRouter before express.json and express.urlencoded for file upload compatibility
app.use('/api/v1/load', loadRouter);

app.use('/api/v1/user', userRouter);
app.use('/api/v1/vehicle', vehicleRouter);
app.use('/api/v1/bid', bidRouter);
app.use('/api/v1/loadboard', loadBoardRouter);
app.use('/api/v1/driver', driverRouter);
app.use('/api/v1/shipper_driver', shipperDriverRouter);
app.use('/api/v1/inhouseUser', inhouseUserRouter);
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
app.use('/api/v1/chat', chatRoutes);
setInterval(checkOverdueBreaks, 60000);


removeUnverifiedAccounts();
connectDB();

app.use(errorMiddleware);
