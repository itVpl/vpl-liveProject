import { Candidate } from "../models/candidateModel.js";
import { sendEmail } from '../utils/sendEmail.js';
import { catchAsyncError } from "../middlewares/catchAsynError.js";
import { getCurrentDateIST, addDaysToIST, formatDateIST } from '../utils/dateUtils.js';

// ✅ Create a new candidate
export const createCandidate = catchAsyncError(async (req, res, next) => {
    try {
        const {
            candidateName,
            department,
            experience,
            currentSalary,
            expectedSalary,
            performanceBasedIncentive,
            currentlyEmployed,
            noticePeriod,
            communicationSkills,
            coldCallsComfort,
            leadGenerationExperience,
            leadGenerationMethod,
            targetDrivenEnvironment,
            officeFieldSales,
            salesMotivation,
            multitaskingComfort,
            clientVendorCommunication,
            operationalMetricsExperience,
            nightShiftsWillingness,
            gurgaonOfficeWillingness,
            fullTimeCommitment,
            phone,
            email,
            interviewDate
        } = req.body;

        // Create candidate object
        const candidateData = {
            candidateName,
            department,
            experience,
            currentSalary,
            expectedSalary,
            performanceBasedIncentive,
            currentlyEmployed,
            noticePeriod,
            communicationSkills,
            nightShiftsWillingness,
            gurgaonOfficeWillingness,
            fullTimeCommitment,
            phone,
            email,
            createdBy: req.user._id
        };

        // Add department-specific fields
        if (department === "Sales") {
            candidateData.coldCallsComfort = coldCallsComfort;
            candidateData.leadGenerationExperience = leadGenerationExperience;
            candidateData.leadGenerationMethod = leadGenerationMethod;
            candidateData.targetDrivenEnvironment = targetDrivenEnvironment;
            candidateData.officeFieldSales = officeFieldSales;
            candidateData.salesMotivation = salesMotivation;
        } else if (department === "CMT") {
            candidateData.multitaskingComfort = multitaskingComfort;
            candidateData.clientVendorCommunication = clientVendorCommunication;
            candidateData.operationalMetricsExperience = operationalMetricsExperience;
        }

        // Add resume if uploaded
        if (req.file) {
            candidateData.resume = req.file.path;
        }

        // Add interview date if provided
        if (interviewDate) {
            candidateData.interviewDate = new Date(interviewDate);
        }

        const candidate = new Candidate(candidateData);
        await candidate.save();

        // Generate video interview link automatically
        try {
            const crypto = await import('crypto');
            const token = crypto.randomBytes(32).toString('hex');
            const expiryDate = addDaysToIST(7);

            candidate.videoInterviewToken = token;
            candidate.videoInterviewStatus = 'Pending';
            candidate.videoInterviewExpiry = expiryDate;
            candidate.videoInterviewLink = `${process.env.FRONTEND_URL || 'https://vpl-liveproject-1.onrender.com'}/video-interview.html?token=${token}`;
            
            await candidate.save();
        } catch (error) {
            console.error('❌ Error generating video interview link:', error);
        }

        // Send confirmation email to candidate with video interview link
        try {
            const subject = `Application Received - ${department} Position`;
            const html = `
                <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                  <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                    <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">📋 Application Received</h1>
                    <div style="background: #27ae60; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                      <h2 style="margin: 0; font-size: 20px;">Thank you for your interest!</h2>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                      <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Application Details</h3>
                      <div style="text-align: left;">
                        <p><strong style="color: #34495e;">Name:</strong> <span style="color: #7f8c8d;">${candidateName}</span></p>
                        <p><strong style="color: #34495e;">Department:</strong> <span style="color: #7f8c8d;">${department}</span></p>
                        <p><strong style="color: #34495e;">Experience:</strong> <span style="color: #7f8c8d;">${experience} years</span></p>
                        <p><strong style="color: #34495e;">Status:</strong> <span style="color: #7f8c8d;">Pending Review</span></p>
                      </div>
                    </div>
                    
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                      <p style="margin: 0; color: #27ae60; font-weight: bold;">🎥 Next Step: Video Interview</p>
                      <p style="margin: 10px 0 0 0; color: #27ae60;">Please complete your 2-minute video interview using the link below.</p>
                    </div>
                    
                    <div style="margin: 25px 0;">
                      <a href="${candidate.videoInterviewLink}" 
                         style="background: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                        🎥 Start Video Interview
                      </a>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                      <p style="margin: 0; color: #856404; font-weight: bold;">⏰ Video interview link expires on ${formatDateIST(candidate.videoInterviewExpiry)}</p>
                    </div>
                    
                    <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                      If you have any questions, please contact our HR team.
                    </p>
                  </div>
                </div>
            `;

            await sendEmail({
                to: email,
                subject,
                html
            });
        } catch (emailError) {
            console.error('❌ Error sending confirmation email:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'Candidate application submitted successfully',
            candidate
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Get all candidates with filtering and pagination
export const getAllCandidates = catchAsyncError(async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            department,
            status,
            experience,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (department) {
            filter.department = department;
        }
        
        if (status) {
            filter.status = status;
        }
        
        if (experience) {
            filter.experience = { $gte: parseInt(experience) };
        }
        
        if (search) {
            filter.$or = [
                { candidateName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort object
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate skip value for pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get candidates with pagination
        const candidates = await Candidate.find(filter)
            .populate('createdBy', 'name email')
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip(skip);

        // Get total count for pagination
        const total = await Candidate.countDocuments(filter);

        // Get statistics
        const stats = await Candidate.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalCandidates: { $sum: 1 },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
                    shortlisted: { $sum: { $cond: [{ $eq: ['$status', 'Shortlisted'] }, 1, 0] } },
                    interviewed: { $sum: { $cond: [{ $eq: ['$status', 'Interviewed'] }, 1, 0] } },
                    selected: { $sum: { $cond: [{ $eq: ['$status', 'Selected'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
                    sales: { $sum: { $cond: [{ $eq: ['$department', 'Sales'] }, 1, 0] } },
                    cmt: { $sum: { $cond: [{ $eq: ['$department', 'CMT'] }, 1, 0] } },
                    avgExperience: { $avg: '$experience' },
                    avgExpectedSalary: { $avg: '$expectedSalary' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            candidates,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            totalCandidates: total,
            statistics: stats[0] || {
                totalCandidates: 0,
                pending: 0,
                shortlisted: 0,
                interviewed: 0,
                selected: 0,
                rejected: 0,
                sales: 0,
                cmt: 0,
                avgExperience: 0,
                avgExpectedSalary: 0
            },
            filters: {
                department: department || 'All',
                status: status || 'All',
                experience: experience || 'All',
                search: search || 'None'
            }
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Get candidate by ID
export const getCandidateById = catchAsyncError(async (req, res, next) => {
    try {
        const { id } = req.params;

        const candidate = await Candidate.findById(id)
            .populate('createdBy', 'name email');

        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        res.status(200).json({
            success: true,
            candidate
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Update candidate status
export const updateCandidateStatus = catchAsyncError(async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, interviewDate, interviewNotes } = req.body;

        const candidate = await Candidate.findById(id);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        // Update status
        candidate.status = status;
        
        // Update interview date if provided
        if (interviewDate) {
            candidate.interviewDate = new Date(interviewDate);
        }
        
        // Update interview notes if provided
        if (interviewNotes) {
            candidate.interviewNotes = interviewNotes;
        }

        await candidate.save();

        // Send status update email to candidate
        try {
            let subject, html;

            if (status === 'Shortlisted') {
                // Special email for shortlisted candidates with interview details
                subject = `🎉 Congratulations! You've Been Shortlisted - Interview Details`;
                
                const interviewDateFormatted = interviewDate ? 
                    new Date(interviewDate).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : 'To be scheduled';

                html = `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 20px; max-width: 700px; margin: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.15);">
                        <div style="background: white; padding: 35px; border-radius: 15px; text-align: center;">
                            <div style="background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 20px; border-radius: 12px; margin-bottom: 30px;">
                                <h1 style="margin: 0; font-size: 32px; font-weight: 700;">🎉 Congratulations!</h1>
                                <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">You've Been Shortlisted</p>
                            </div>
                            
                            <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin-bottom: 25px; text-align: left;">
                                <h3 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                                    📋 Candidate Information
                                </h3>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                    <div>
                                        <p style="margin: 8px 0;"><strong style="color: #34495e;">Name:</strong> <span style="color: #7f8c8d;">${candidate.candidateName}</span></p>
                                        <p style="margin: 8px 0;"><strong style="color: #34495e;">Department:</strong> <span style="color: #7f8c8d;">${candidate.department}</span></p>
                                    </div>
                                    <div>
                                        <p style="margin: 8px 0;"><strong style="color: #34495e;">Phone:</strong> <span style="color: #7f8c8d;">${candidate.phone}</span></p>
                                        <p style="margin: 8px 0;"><strong style="color: #34495e;">Email:</strong> <span style="color: #7f8c8d;">${candidate.email}</span></p>
                                    </div>
                                </div>
                            </div>

                            <div style="background: linear-gradient(135deg, #e8f5e8, #d4edda); padding: 25px; border-radius: 12px; margin-bottom: 25px; border-left: 5px solid #27ae60;">
                                <h3 style="color: #27ae60; margin: 0 0 20px 0; font-size: 20px;">
                                    📅 Interview Details
                                </h3>
                                <div style="text-align: left;">
                                    <p style="margin: 12px 0; font-size: 16px;">
                                        <strong style="color: #2c3e50;">Interview Date & Time:</strong><br>
                                        <span style="color: #27ae60; font-weight: 600; font-size: 18px;">${interviewDateFormatted}</span>
                                    </p>
                                    ${interviewNotes ? `
                                        <p style="margin: 12px 0; font-size: 16px;">
                                            <strong style="color: #2c3e50;">Additional Notes:</strong><br>
                                            <span style="color: #7f8c8d; font-style: italic;">${interviewNotes}</span>
                                        </p>
                                    ` : ''}
                                </div>
                            </div>

                            <div style="background: linear-gradient(135deg, #fff3cd, #ffeaa7); padding: 25px; border-radius: 12px; margin-bottom: 25px; border-left: 5px solid #f39c12;">
                                <h3 style="color: #d68910; margin: 0 0 20px 0; font-size: 20px;">
                                    🏢 Office Location
                                </h3>
                                <div style="text-align: left;">
                                    <p style="margin: 12px 0; font-size: 16px; line-height: 1.6;">
                                        <strong style="color: #2c3e50;">Address:</strong><br>
                                        <span style="color: #7f8c8d; font-weight: 500;">
                                            C-14, Udyog Vihar Phase V,<br>
                                            Sector 19, Gurugram,<br>
                                            Haryana 122016
                                        </span>
                                    </p>
                                    <div style="margin-top: 15px;">
                                        <a href="https://maps.app.goo.gl/ngmJYvm6H3oDFZqG8" 
                                           style="display: inline-block; background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: 600; transition: all 0.3s ease;">
                                            📍 View on Google Maps
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div style="background: linear-gradient(135deg, #dbeafe, #bfdbfe); padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 5px solid #3498db;">
                                <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">
                                    📋 Important Instructions
                                </h3>
                                <ul style="margin: 0; padding-left: 20px; text-align: left; color: #1e3a8a;">
                                    <li style="margin: 8px 0;">Please arrive 10 minutes before your scheduled interview time</li>
                                    <li style="margin: 8px 0;">Bring a copy of your resume and any relevant documents</li>
                                    <li style="margin: 8px 0;">Dress professionally for the interview</li>
                                    <li style="margin: 8px 0;">If you need to reschedule, please contact us at least 24 hours in advance</li>
                                </ul>
                            </div>

                            <div style="background: #e8f5e8; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
                                <p style="margin: 0; color: #27ae60; font-weight: 600; font-size: 16px;">
                                    🎯 We look forward to meeting you and discussing your potential role with our team!
                                </p>
                            </div>
                            
                            <div style="border-top: 1px solid #ecf0f1; padding-top: 20px; margin-top: 20px;">
                                <p style="margin: 0; color: #95a5a6; font-size: 14px;">
                                    If you have any questions or need to reschedule, please contact our HR team.<br>
                                    <strong>Email:</strong> hr@vpl.com | <strong>Phone:</strong> +91-XXXXXXXXXX
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Standard email for other status updates
                const statusMessages = {
                    'Interviewed': 'Thank you for attending the interview.',
                    'Selected': 'Congratulations! You have been selected for the position.',
                    'Rejected': 'Thank you for your interest. Unfortunately, we cannot proceed with your application at this time.'
                };

                subject = `Application Status Update - ${status}`;
                html = `
                    <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                      <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                        <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">📋 Status Update</h1>
                        <div style="background: ${status === 'Selected' ? '#27ae60' : status === 'Rejected' ? '#e74c3c' : '#3498db'}; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                          <h2 style="margin: 0; font-size: 20px;">${status}</h2>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                          <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Application Details</h3>
                          <div style="text-align: left;">
                            <p><strong style="color: #34495e;">Name:</strong> <span style="color: #7f8c8d;">${candidate.candidateName}</span></p>
                            <p><strong style="color: #34495e;">Department:</strong> <span style="color: #7f8c8d;">${candidate.department}</span></p>
                            <p><strong style="color: #34495e;">Status:</strong> <span style="color: #7f8c8d;">${status}</span></p>
                            ${interviewDate ? `<p><strong style="color: #34495e;">Interview Date:</strong> <span style="color: #7f8c8d;">${new Date(interviewDate).toLocaleDateString()}</span></p>` : ''}
                            ${interviewNotes ? `<p><strong style="color: #34495e;">Notes:</strong> <span style="color: #7f8c8d;">${interviewNotes}</span></p>` : ''}
                          </div>
                        </div>
                        
                        <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                          <p style="margin: 0; color: #27ae60; font-weight: bold;">${statusMessages[status] || 'Your application status has been updated.'}</p>
                        </div>
                        
                        <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                          If you have any questions, please contact our HR team.
                        </p>
                      </div>
                    </div>
                `;
            }

            await sendEmail({
                to: candidate.email,
                subject,
                html
            });
        } catch (emailError) {
            console.error('❌ Error sending status update email:', emailError);
        }

        res.status(200).json({
            success: true,
            message: 'Candidate status updated successfully',
            candidate
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Update candidate details
export const updateCandidate = catchAsyncError(async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Remove fields that shouldn't be updated directly
        delete updateData.status;
        delete updateData.createdBy;
        delete updateData.createdAt;

        // Update resume if new file uploaded
        if (req.file) {
            updateData.resume = req.file.path;
        }

        const candidate = await Candidate.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Candidate updated successfully',
            candidate
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Delete candidate
export const deleteCandidate = catchAsyncError(async (req, res, next) => {
    try {
        const { id } = req.params;

        const candidate = await Candidate.findByIdAndDelete(id);

        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Candidate deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Get candidate statistics
export const getCandidateStats = catchAsyncError(async (req, res, next) => {
    try {
        const stats = await Candidate.aggregate([
            {
                $group: {
                    _id: null,
                    totalCandidates: { $sum: 1 },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
                    shortlisted: { $sum: { $cond: [{ $eq: ['$status', 'Shortlisted'] }, 1, 0] } },
                    interviewed: { $sum: { $cond: [{ $eq: ['$status', 'Interviewed'] }, 1, 0] } },
                    selected: { $sum: { $cond: [{ $eq: ['$status', 'Selected'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
                    sales: { $sum: { $cond: [{ $eq: ['$department', 'Sales'] }, 1, 0] } },
                    cmt: { $sum: { $cond: [{ $eq: ['$department', 'CMT'] }, 1, 0] } },
                    avgExperience: { $avg: '$experience' },
                    avgExpectedSalary: { $avg: '$expectedSalary' },
                    avgCurrentSalary: { $avg: '$currentSalary' }
                }
            }
        ]);

        // Get recent candidates
        const recentCandidates = await Candidate.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('candidateName department status createdAt');

        // Get department-wise statistics
        const departmentStats = await Candidate.aggregate([
            {
                $group: {
                    _id: '$department',
                    count: { $sum: 1 },
                    avgExperience: { $avg: '$experience' },
                    avgExpectedSalary: { $avg: '$expectedSalary' },
                    statusBreakdown: {
                        $push: {
                            status: '$status',
                            candidateName: '$candidateName'
                        }
                    }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            statistics: stats[0] || {
                totalCandidates: 0,
                pending: 0,
                shortlisted: 0,
                interviewed: 0,
                selected: 0,
                rejected: 0,
                sales: 0,
                cmt: 0,
                avgExperience: 0,
                avgExpectedSalary: 0,
                avgCurrentSalary: 0
            },
            recentCandidates,
            departmentStats
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Schedule interview
export const scheduleInterview = catchAsyncError(async (req, res, next) => {
    try {
        const { id } = req.params;
        const { interviewDate, interviewNotes, interviewType = 'In-person' } = req.body;

        if (!interviewDate) {
            return res.status(400).json({
                success: false,
                message: 'Interview date is required'
            });
        }

        const candidate = await Candidate.findById(id);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        // Update candidate
        candidate.status = 'Shortlisted';
        candidate.interviewDate = new Date(interviewDate);
        candidate.interviewNotes = interviewNotes || candidate.interviewNotes;
        await candidate.save();

        // Send interview invitation email
        try {
            const subject = `Interview Invitation - ${candidate.department} Position`;
            const html = `
                <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                  <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                    <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">📅 Interview Invitation</h1>
                    <div style="background: #3498db; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                      <h2 style="margin: 0; font-size: 20px;">You're Invited!</h2>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                      <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Interview Details</h3>
                      <div style="text-align: left;">
                        <p><strong style="color: #34495e;">Name:</strong> <span style="color: #7f8c8d;">${candidate.candidateName}</span></p>
                        <p><strong style="color: #34495e;">Department:</strong> <span style="color: #7f8c8d;">${candidate.department}</span></p>
                        <p><strong style="color: #34495e;">Interview Date:</strong> <span style="color: #7f8c8d;">${new Date(interviewDate).toLocaleString()}</span></p>
                        <p><strong style="color: #34495e;">Interview Type:</strong> <span style="color: #7f8c8d;">${interviewType}</span></p>
                        ${interviewNotes ? `<p><strong style="color: #34495e;">Additional Notes:</strong> <span style="color: #7f8c8d;">${interviewNotes}</span></p>` : ''}
                      </div>
                    </div>
                    
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                      <p style="margin: 0; color: #27ae60; font-weight: bold;">✅ Please confirm your attendance by replying to this email!</p>
                    </div>
                    
                    <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                      If you have any questions or need to reschedule, please contact our HR team.
                    </p>
                  </div>
                </div>
            `;

            await sendEmail({
                to: candidate.email,
                subject,
                html
            });
        } catch (emailError) {
            console.error('❌ Error sending interview invitation:', emailError);
        }

        res.status(200).json({
            success: true,
            message: 'Interview scheduled successfully',
            candidate
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Bulk status update
export const bulkStatusUpdate = catchAsyncError(async (req, res, next) => {
    try {
        const { candidateIds, status, interviewDate, interviewNotes } = req.body;

        if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Candidate IDs array is required'
            });
        }

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const updateData = { status };
        
        if (interviewDate) {
            updateData.interviewDate = new Date(interviewDate);
        }
        
        if (interviewNotes) {
            updateData.interviewNotes = interviewNotes;
        }

        const result = await Candidate.updateMany(
            { _id: { $in: candidateIds } },
            updateData
        );

        res.status(200).json({
            success: true,
            message: `Status updated for ${result.modifiedCount} candidates`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        next(error);
    }
}); 