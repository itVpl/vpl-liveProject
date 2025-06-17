import express from 'express';
import { register, verifyOTP, login, logout, getUser, forgetPassword, resetPassword } from '../controllers/userController.js';
import { logoutEmployee } from '../controllers/inhouseUserController.js';
import { isAuthenticatedUser, isAuthenticatedEmployee } from '../middlewares/auth.js';

const userRouter = express.Router();
userRouter.post('/register', register);
userRouter.post('/otp-verification', verifyOTP); 
userRouter.post('/login', login);
userRouter.post('/logout', isAuthenticatedEmployee, logoutEmployee);
userRouter.get('/me', isAuthenticatedUser, getUser);
userRouter.post('/password/forget', forgetPassword);
userRouter.put('/password/reset/:token', resetPassword); 

export default userRouter;