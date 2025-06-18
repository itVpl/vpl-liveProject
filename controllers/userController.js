import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsynError.js";
import { User } from "../models/userModel.js";
// import { sendEmail } from "../utils/sendEmail.js";
import { sendEmail } from "../utils/sendEmail.js";
import twilio from "twilio";
import { sendToken } from "../utils/sendToken.js";
import crypto from "crypto";

export const register = catchAsyncError(async (req, res, next) => {
  const { name, email, phone, password, verificationMethod } = req.body;

  if (!name || !email || !phone || !password || !verificationMethod) {
    return next(new ErrorHandler("Please provide all required fields", 400));
  }

  function validatePhoneNumber(phone) {
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  if (!validatePhoneNumber(phone)) {
    return next(
      new ErrorHandler(
        "Invalid phone number format. It should start with +91 and be followed by 10 digits starting with 6, 7, 8, or 9.",
        400
      )
    );
  }

  const userExists = await User.findOne({
    $or: [
      { email, accountVerified: true },
      { phone, accountVerified: true },
    ],
  });

  if (userExists) {
    return next(new ErrorHandler("User already exists", 400));
  }

  const registrationAttemptByUser = await User.countDocuments({
    $or: [
      { email, accountVerified: false },
      { phone, accountVerified: false },
    ],
  });

  if (registrationAttemptByUser > 3) {
    return next(
      new ErrorHandler(
        "You have exceeded the maximum number of registration attempts. Please try again later.",
        400
      )
    );
  }

  const user = await User.create({
    name,
    email,
    phone,
    password,
  });

  const verificationCode = await user.generateVerificationCode();
  await user.save();

  await sendVerificationCode(
    verificationMethod,
    verificationCode,
    email,
    phone
  );

  res.status(200).json({
    success: true,
  });
});

async function sendVerificationCode(
  verificationMethod,
  verificationCode,
  email,
  phone
) {
  try {
    if (verificationMethod === "email") {
      const message = generateEmailTemplate(verificationCode);
      await sendEmail({
        email: email,
        subject: "Verification Code",
        message: message,
      });
    } else if (verificationMethod === "phone") {
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      const verificationCodeWithSpaces = verificationCode
        .toString()
        .split("")
        .join(" ");

      await client.calls
        .create({
          twiml: `<Response><Say>Your verification code is ${verificationCodeWithSpaces}. It will expire in 5 minutes.</Say></Response>`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone,
        })
        .then((call) => console.log("Call SID:", call.sid))
        .catch((error) => {
          console.error("Error sending call via Twilio:", error);
          throw new ErrorHandler("Call could not be sent", 500);
        });
    } else {
      throw new ErrorHandler("Invalid verification method", 500);
    }
  } catch (error) {
    console.error("Error in sendVerificationCode:", error);
    throw new ErrorHandler(
      "Failed to send verification code. Please try again later.",
      500
    );
  }
}

function generateEmailTemplate(verificationCode) {
  return `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6fb; padding: 40px 0;">
    <div style="max-width: 420px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.07); padding: 32px 28px;">
      <div style="text-align: center;">
        <img src="https://cdn-icons-png.flaticon.com/512/561/561127.png" alt="Verification" width="64" style="margin-bottom: 16px;" />
        <h2 style="color: #2d3748; margin-bottom: 8px;">Verify Your Account</h2>
        <p style="color: #4a5568; font-size: 16px; margin-bottom: 24px;">
          Please use the code below to verify your account.
        </p>
        <div style="display: inline-block; background: #f0f4fa; border-radius: 8px; padding: 18px 32px; margin-bottom: 24px;">
          <span style="font-size: 32px; letter-spacing: 8px; color: #2b6cb0; font-weight: bold;">
            ${verificationCode}
          </span>
        </div>
        <p style="color: #718096; font-size: 14px;">
          This code will expire in <b>5 minutes</b>.
        </p>
      </div>
    </div>
    <p style="text-align: center; color: #a0aec0; font-size: 12px; margin-top: 24px;">
      If you did not request this, please ignore this email.
    </p>
  </div>
`;
}



export const verifyOTP = catchAsyncError(async (req, res, next) => {
  const { email, otp, phone } = req.body;

  const phoneRegex = /^\+91[6-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return next(new ErrorHandler("Invalid phone number format.", 400));
  }

  const user = await User.findOne({
    $or: [
      { email, accountVerified: false },
      { phone, accountVerified: false },
    ],
  }).sort({ createdAt: -1 });

  if (!user) {
    return next(new ErrorHandler("User not found or already verified", 404));
  }

  if (user.verificationCode !== Number(otp)) {
    return next(new ErrorHandler("Invalid OTP", 400));
  }

  const currentTime = Date.now();
  const verificationCodeExpires = new Date(
    user.verificationCodeExpires
  ).getTime();

  if (currentTime > verificationCodeExpires) {
    return next(new ErrorHandler("OTP has expired", 400));
  }

  user.accountVerified = true;
  user.verificationCode = null;
  user.verificationCodeExpires = null;
  await user.save();

  // Optional: also send a token after verification
  return sendToken(user, 200, "Account Verified", res);
});

export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("Please provide email and password", 400));
  }
  const user = await User.findOne({ email, accountVerified: true }).select(
    "+password"
  );
  if (!user) {
    return next(new ErrorHandler("Invalid email or password", 400));
  }
  const isPasswordMatched = await user.comparePassword(password);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password", 400));
  }
  if (!user.accountVerified) {
    return next(new ErrorHandler("Account not verified", 400));
  }
  sendToken(user, 200, "Login successful", res);
});

export const logout = catchAsyncError(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out successfully",
    });
});

export const getUser = catchAsyncError(async (req, res, next) => {
  const user = req.user;
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }
  res.status(200).json({
    success: true,
    user,
  });
});

export const forgetPassword = catchAsyncError(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true,
  });
  if (!user) {
    return next(
      new ErrorHandler("User not found or account not verified", 404)
    );
  }
  const resetToken = user.generateResetPasswordToken();
  await user.save({ validateBeforeSave: false });
  const resetPasswordUrl = `${process.env.CLIENT_URL}/password/reset/${resetToken}`;
  const message = `
    <h1>Reset Password</h1>
    <p>To reset your password, please click on the link below:</p>
    <a href="${resetPasswordUrl}">Reset Password</a>
    <p>This link will expire in 30 minutes.</p>
  `;

  try {
    sendEmail({
      email: user.email,
      subject: "Reset Password",
      message: message,
    });
    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} with reset password instructions`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new ErrorHandler("Email could not be sent. Please try again later.", 500)
    );
  }
});

export const resetPassword = catchAsyncError(async (req, res, next) => {
  const {token} = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new ErrorHandler("Invalid or expired reset token", 400));
  }
  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHandler("Passwords do not match", 400));
  }
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();  
  sendToken(user, 200, "Password reset successful", res);
})


