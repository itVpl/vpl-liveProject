import { catchAsyncError } from "./catchAsynError.js";
import ErrorHandler from "./error.js";
import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";
import { Employee } from "../models/inhouseUserModel.js";

export const isAuthenticatedUser = catchAsyncError(async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return next(new ErrorHandler("Please login to access this resource", 400));
    }
    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decodedData.id);

    next();
});

// export const isAuthenticatedEmployee = catchAsyncError(async (req, res, next) => {
//     const token = req.cookies.token;
//     if (!token) {
//         return next(new ErrorHandler("Please login to access this resource", 400));
//     }
//     const decodedData = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = await Employee.findById(decodedData.id);

//     next();
// });



export const isAuthenticatedEmployee = catchAsyncError(async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return next(new ErrorHandler("Please login to access this resource", 400));
    }

    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    const employee = await Employee.findById(decodedData.id);

    console.log("✅ Logged-in User Department:", employee?.department);  // 👀 DEBUG

    if (!employee) {
        return next(new ErrorHandler("Employee not found", 404));
    }

    req.user = employee;  // 👈 IMPORTANT
    next();
});