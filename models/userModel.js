import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
const userSchema = new mongoose.Schema({
   name: {
      type: String,
      required: [true, "Please enter your name"],
      trim: true,
   },
    email: {
        type: String,
        required: [true, "Please enter your email"],
        unique: true,
        trim: true,
        lowercase: true,
    },  
    password: {
        type: String,
        required: [true, "Please enter your password"],
        minlength: [8, "Password must be at least 6 characters"],
        // maxlength: [20, "Password cannot exceed 20 characters"],
        select: false, 
    },
    phone: String,
    accountVerified: {
        type: Boolean,
        default: false,
    },
    verificationCode: Number,
    varificationCodeExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date, 
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
}    

userSchema.methods.generateVerificationCode = function () {
    function generateRandomFiveDigitNumber() {
        const fiveDigit = Math.floor(Math.random() * 9) + 1;
        const remaingingDigits = Math.floor(Math.random() * 10000).toString().padStart(4, 0);
        return parseInt(fiveDigit+ remaingingDigits);
    }
    const verificationCode = generateRandomFiveDigitNumber();
    this.verificationCode = verificationCode;
    this.varificationCodeExpires = Date.now() + 5 * 60 * 1000; // Code expires in 5 minutes

    return verificationCode;
};
userSchema.methods.generateToken = function () {
    return  jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
        algorithm: 'HS256'
    });
}

userSchema.methods.generateResetPasswordToken = function () {
    const resetToken = crypto.randomBytes(32).toString("hex");
    this.resetPasswordToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
    this.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // Token expires in 30 minutes
    return resetToken;
};

export const User = mongoose.model("User", userSchema);


