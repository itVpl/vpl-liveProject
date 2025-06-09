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

export const app = express();

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
//     origin: process.env.CLIENT_URL,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//     credentials: true,
// }));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/v1/user', userRouter);
app.use('/api/v1/vehicle', vehicleRouter);
app.use('/api/v1/load', loadRouter);
removeUnverifiedAccounts();
connectDB();

app.use(errorMiddleware);
