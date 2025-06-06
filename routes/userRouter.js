import express from 'express';
import { register, verifyOTP, login, logout, getUser, forgetPassword, resetPassword } from '../controllers/userController.js';
import { isAuthenticatedUser } from '../middlewares/auth.js';

const userRouter = express.Router();
userRouter.post('/register', register);
userRouter.post('/otp-verification', verifyOTP); 
userRouter.post('/login', login);
userRouter.get('/logout', isAuthenticatedUser,logout)
userRouter.get('/me', isAuthenticatedUser, getUser);
userRouter.post('/password/forget', forgetPassword);
userRouter.put('/password/reset/:token', resetPassword); 


export default userRouter;