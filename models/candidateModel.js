import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema({
    // Basic Information
    candidateName: {
        type: String,
        required: [true, "Please enter candidate name"],
        trim: true,
    },
    department: {
        type: String,
        required: [true, "Please select department"],
        enum: ["Sales", "CMT"],
    },
    experience: {
        type: Number,
        required: [true, "Please enter years of experience"],
        min: [0, "Experience cannot be negative"],
    },
    currentSalary: {
        type: Number,
        required: [true, "Please enter current salary"],
        min: [0, "Salary cannot be negative"],
    },
    expectedSalary: {
        type: Number,
        required: [true, "Please enter expected salary"],
        min: [0, "Expected salary cannot be negative"],
    },
    performanceBasedIncentive: {
        type: String,
        required: [true, "Please answer about performance-based incentive structure"],
        enum: ["Yes", "No"],
    },
    currentlyEmployed: {
        type: String,
        required: [true, "Please answer if currently employed"],
        enum: ["Yes", "No"],
    },
    noticePeriod: {
        type: String,
        trim: true,
        default: "",
    },

    // Skills & Communication (Sales)
    communicationSkills: {
        type: String,
        required: [true, "Please rate your communication skills"],
        enum: ["Beginner", "Intermediate", "Expert"],
    },
    coldCallsComfort: {
        type: String,
        enum: ["Yes", "No"],
        default: null,
    },
    leadGenerationExperience: {
        type: String,
        enum: ["Yes", "No"],
        default: null,
    },
    leadGenerationMethod: {
        type: String,
        trim: true,
        default: "",
    },
    targetDrivenEnvironment: {
        type: String,
        enum: ["Yes", "No"],
        default: null,
    },
    officeFieldSales: {
        type: String,
        enum: ["Yes", "No"],
        default: null,
    },
    salesMotivation: {
        type: String,
        enum: ["Achieving targets", "Earning incentives", "Building client relationships"],
        default: null,
    },

    // Skills & Communication (CMT)
    multitaskingComfort: {
        type: String,
        enum: ["Yes", "No"],
        default: null,
    },
    clientVendorCommunication: {
        type: String,
        enum: ["Yes", "No"],
        default: null,
    },
    operationalMetricsExperience: {
        type: String,
        enum: ["Yes", "No"],
        default: null,
    },

    // Work Flexibility & Commitment (Sales and CMT)
    nightShiftsWillingness: {
        type: String,
        required: [true, "Please answer about night shifts willingness"],
        enum: ["Yes", "No"],
    },
    gurgaonOfficeWillingness: {
        type: String,
        required: [true, "Please answer about working from Gurgaon office"],
        enum: ["Yes", "No"],
    },
    fullTimeCommitment: {
        type: String,
        required: [true, "Please answer about full-time commitment"],
        enum: ["Yes", "No"],
    },

    // Additional Information
    phone: {
        type: String,
        required: [true, "Please enter phone number"],
        trim: true,
    },
    email: {
        type: String,
        required: [true, "Please enter email"],
        trim: true,
        lowercase: true,
    },
    resume: {
        type: String, // File path for uploaded resume
        default: "",
    },
    status: {
        type: String,
        enum: ["Pending", "Shortlisted", "Interviewed", "Selected", "Rejected"],
        default: "Pending",
    },
    interviewDate: {
        type: Date,
        default: null,
    },
    interviewNotes: {
        type: String,
        trim: true,
        default: "",
    },
    // Video Interview Fields
    videoInterviewLink: {
        type: String,
        default: "",
    },
    videoInterviewToken: {
        type: String,
        default: "",
    },
    videoInterviewStatus: {
        type: String,
        enum: ["Pending", "Completed", "Expired"],
        default: "Pending",
    },
    videoInterviewUrl: {
        type: String,
        default: "",
    },
    videoInterviewExpiry: {
        type: Date,
        default: null,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update the updatedAt field before saving
candidateSchema.pre("save", function (next) {
    this.updatedAt = Date.now();
    next();
});

// Validation for department-specific fields
candidateSchema.pre("save", function (next) {
    if (this.department === "Sales") {
        if (!this.coldCallsComfort || !this.leadGenerationExperience || 
            !this.targetDrivenEnvironment || !this.officeFieldSales || 
            !this.salesMotivation) {
            return next(new Error("Sales department requires all sales-specific fields"));
        }
    } else if (this.department === "CMT") {
        if (!this.multitaskingComfort || !this.clientVendorCommunication || 
            !this.operationalMetricsExperience) {
            return next(new Error("CMT department requires all CMT-specific fields"));
        }
    }
    next();
});

// Experience validation based on department
candidateSchema.pre("save", function (next) {
    if (this.department === "Sales" && this.experience < 2) {
        return next(new Error("Sales candidates must have minimum 2 years of experience"));
    }
    if (this.department === "CMT" && this.experience < 1) {
        return next(new Error("CMT candidates must have minimum 1 year of experience"));
    }
    next();
});

export const Candidate = mongoose.model("Candidate", candidateSchema); 