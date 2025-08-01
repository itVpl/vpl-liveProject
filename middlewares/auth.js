import { catchAsyncError } from "./catchAsynError.js";
import ErrorHandler from "./error.js";
import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";
import { Employee } from "../models/inhouseUserModel.js";
import ShipperDriver from "../models/shipper_driverModel.js";
import Driver from "../models/driverModel.js";

export const isAuthenticatedUser = catchAsyncError(async (req, res, next) => {
    let token = req.cookies.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new ErrorHandler("Please login to access this resource", 400));
    }

    const decodedData = jwt.verify(token, process.env.JWT_SECRET);

    // Try to find user in User model first
    let user = await User.findById(decodedData.id);

    // If not found in User model, try Employee model
    if (!user) {
        user = await Employee.findById(decodedData.id);
    }

    // If not found in Employee model, try ShipperDriver model
    if (!user) {
        user = await ShipperDriver.findById(decodedData.id);
        if (user && user.status !== 'approved') {
            return next(new ErrorHandler(`Your account is ${user.status}. Please wait for approval.`, 403));
        }
    }

    // If not found in ShipperDriver, try Driver model
    if (!user) {
        user = await Driver.findById(decodedData.id);
        if (user) {
        }
    }

    if (!user) {
        return next(new ErrorHandler("User not found", 404));
    }

    req.user = user;
    next();
});

// 🔥 New: Middleware to ensure only shippers can post loads
export const isShipper = catchAsyncError(async (req, res, next) => {
    let token = req.cookies.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new ErrorHandler("Please login to access this resource", 400));
    }

    try {
        const decodedData = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user is ShipperDriver with userType 'shipper'
        const user = await ShipperDriver.findById(decodedData.id);


        if (!user) {
            return next(new ErrorHandler("User not found", 404));
        }

        if (user.status !== 'approved') {
            return next(new ErrorHandler(`Your account is ${user.status}. Please wait for approval.`, 403));
        }

        if (user.userType !== 'shipper') {
            return next(new ErrorHandler("Only shippers can perform this action", 403));
        }

        req.user = user;
        console.log('🔍 Debug - User set in req.user:', req.user._id);
        next();
    } catch (error) {
        console.error('🔍 Debug - JWT verification error:', error);
        return next(new ErrorHandler("Invalid token", 401));
    }
});

// 🔥 New: Middleware to ensure only truckers can place bids
export const isTrucker = catchAsyncError(async (req, res, next) => {
    let token = req.cookies.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new ErrorHandler("Please login to access this resource", 400));
    }

    const decodedData = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is ShipperDriver with userType 'trucker'
    const user = await ShipperDriver.findById(decodedData.id);

    if (!user) {
        return next(new ErrorHandler("User not found", 404));
    }

    if (user.status !== 'approved') {
        return next(new ErrorHandler(`Your account is ${user.status}. Please wait for approval.`, 403));
    }

    if (user.userType !== 'trucker') {
        return next(new ErrorHandler("Only truckers can perform this action", 403));
    }

    req.user = user;
    next();
});

// // export const isAuthenticatedEmployee = catchAsyncError(async (req, res, next) => {
// //     const token = req.cookies.token;
// //     if (!token) {
// //         return next(new ErrorHandler("Please login to access this resource", 400));
// //     }
// //     const decodedData = jwt.verify(token, process.env.JWT_SECRET);
// //     req.user = await Employee.findById(decodedData.id);

// //     next();
// // });



// export const isAuthenticatedEmployee = catchAsyncError(async (req, res, next) => {
//     let token = req.cookies.token;
//     if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
//         token = req.headers.authorization.split(' ')[1];
//     }
//     if (!token) {
//         return next(new ErrorHandler("Please login to access this resource", 400));
//     }

//     const decodedData = jwt.verify(token, process.env.JWT_SECRET);
//     const employee = await Employee.findById(decodedData.id);

//     // console.log("✅ Logged-in User Department:", employee?.department);  // 👀 DEBUG

//     if (!employee) {
//         return next(new ErrorHandler("Employee not found", 404));
//     }

//     req.user = employee;  // 👈 IMPORTANT
//     next();
// });




// ✅ Generic Auth Middleware (Admin, ShipperDriver, Driver)
// export const isAuthenticatedUser = catchAsyncError(async (req, res, next) => {
//   let token = req.cookies.token;

//   if (!token && req.headers.authorization?.startsWith("Bearer ")) {
//     token = req.headers.authorization.split(" ")[1];
//   }

//   if (!token) {
//     return next(new ErrorHandler("Please login to access this resource", 400));
//   }

//   const decodedData = jwt.verify(token, process.env.JWT_SECRET);
//   const userId = decodedData.id;

//   // Try admin/user
//   let user = await User.findById(userId);
//   if (user) {
//     req.user = user;
//     return next();
//   }

//   // Try trucker/shipper
//   user = await ShipperDriver.findById(userId);
//   if (user) {
//     if (user.status !== "approved") {
//       return next(new ErrorHandler(`Your account is ${user.status}. Please wait for approval.`, 403));
//     }
//     req.user = user;
//     return next();
//   }

//   // Try driver
//   user = await Driver.findById(userId);
//   if (user) {
//     req.user = user;
//     return next();
//   }

//   console.log("❌ No user found for ID:", userId);
//   return next(new ErrorHandler("User not found", 404));
// });

// // ✅ Only Shippers
// export const isShipper = catchAsyncError(async (req, res, next) => {
//   let token = req.cookies.token;

//   if (!token && req.headers.authorization?.startsWith("Bearer ")) {
//     token = req.headers.authorization.split(" ")[1];
//   }

//   if (!token) {
//     return next(new ErrorHandler("Please login to access this resource", 400));
//   }

//   const decodedData = jwt.verify(token, process.env.JWT_SECRET);
//   const user = await ShipperDriver.findById(decodedData.id);

//   if (!user) {
//     return next(new ErrorHandler("User not found", 404));
//   }

//   if (user.status !== "approved") {
//     return next(new ErrorHandler(`Your account is ${user.status}. Please wait for approval.`, 403));
//   }

//   if (user.userType !== "shipper") {
//     return next(new ErrorHandler("Only shippers can perform this action", 403));
//   }

//   req.user = user;
//   next();
// });

// // ✅ Only Truckers
// export const isTrucker = catchAsyncError(async (req, res, next) => {
//   let token = req.cookies.token;

//   if (!token && req.headers.authorization?.startsWith("Bearer ")) {
//     token = req.headers.authorization.split(" ")[1];
//   }

//   if (!token) {
//     return next(new ErrorHandler("Please login to access this resource", 400));
//   }

//   const decodedData = jwt.verify(token, process.env.JWT_SECRET);
//   const user = await ShipperDriver.findById(decodedData.id);

//   if (!user) {
//     return next(new ErrorHandler("User not found", 404));
//   }

//   if (user.status !== "approved") {
//     return next(new ErrorHandler(`Your account is ${user.status}. Please wait for approval.`, 403));
//   }

//   if (user.userType !== "trucker") {
//     return next(new ErrorHandler("Only truckers can perform this action", 403));
//   }

//   req.user = user;
//   next();
// });

// // ✅ Only Inhouse Employees
export const isAuthenticatedEmployee = catchAsyncError(async (req, res, next) => {
  let token = req.cookies.token;

  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ErrorHandler("Please login to access this resource", 400));
  }

  const decodedData = jwt.verify(token, process.env.JWT_SECRET);
  const employee = await Employee.findById(decodedData.id);

  if (!employee) {
    return next(new ErrorHandler("Employee not found", 404));
  }

  req.user = employee;
  next();
});

// ✅ Only Drivers (NEW – Dedicated Driver Middleware)
export const isAuthenticatedDriver = catchAsyncError(async (req, res, next) => {
  let token = req.cookies.token;

  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ErrorHandler("Driver login required", 401));
  }

  const decodedData = jwt.verify(token, process.env.JWT_SECRET);
  const driver = await Driver.findById(decodedData.id);

  if (!driver) {
    return next(new ErrorHandler("Driver not found", 404));
  }

  req.user = driver;
  next();
});
