import { Candidate } from "../models/candidateModel.js";
import { sendEmail } from '../utils/sendEmail.js';
import { catchAsyncError } from "../middlewares/catchAsynError.js";
import AWS from 'aws-sdk';
import crypto from 'crypto';
import path from 'path';

// AWS S3 Configuration
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'eu-north-1',
    signatureVersion: 'v4',
    correctClockSkew: true
});

const BUCKET = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;

// Log AWS configuration (without sensitive data)
console.log('🔧 AWS S3 Configuration:', {
    region: process.env.AWS_REGION || 'eu-north-1',
    bucket: BUCKET ? 'Configured' : 'Missing',
    accessKey: process.env.AWS_ACCESS_KEY_ID ? 'Present' : 'Missing',
    secretKey: process.env.AWS_SECRET_ACCESS_KEY ? 'Present' : 'Missing'
});

// ✅ Generate video interview link for candidate
export const generateVideoInterviewLink = catchAsyncError(async (req, res, next) => {
    try {
        const { candidateId } = req.params;

        const candidate = await Candidate.findById(candidateId);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        // Generate unique token
        const token = crypto.randomBytes(32).toString('hex');
        
        // Set expiry to 7 days from now
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        // Update candidate with video interview details
        candidate.videoInterviewToken = token;
        candidate.videoInterviewStatus = 'Pending';
        candidate.videoInterviewExpiry = expiryDate;
        candidate.videoInterviewLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/video-interview/${token}`;
        
        await candidate.save();

        // Send email with video interview link
        try {
            const subject = `🎥 Video Interview Invitation - ${candidate.department} Position`;
            const html = `
                <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                  <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                    <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">🎥 Video Interview Invitation</h1>
                    <div style="background: #3498db; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                      <h2 style="margin: 0; font-size: 20px;">Record Your 2-Minute Interview</h2>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                      <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Interview Details</h3>
                      <div style="text-align: left;">
                        <p><strong style="color: #34495e;">Name:</strong> <span style="color: #7f8c8d;">${candidate.candidateName}</span></p>
                        <p><strong style="color: #34495e;">Department:</strong> <span style="color: #7f8c8d;">${candidate.department}</span></p>
                        <p><strong style="color: #34495e;">Duration:</strong> <span style="color: #7f8c8d;">2 minutes maximum</span></p>
                        <p><strong style="color: #34495e;">Expiry:</strong> <span style="color: #7f8c8d;">${expiryDate.toLocaleDateString()}</span></p>
                      </div>
                    </div>
                    
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                      <p style="margin: 0; color: #27ae60; font-weight: bold;">🎯 Instructions:</p>
                      <ul style="text-align: left; margin: 10px 0; color: #27ae60;">
                        <li>Click the button below to start your video interview</li>
                        <li>Allow camera and microphone access when prompted</li>
                        <li>Introduce yourself and share your experience</li>
                        <li>Explain why you want to join our team</li>
                        <li>Keep your response under 2 minutes</li>
                      </ul>
                    </div>
                    
                    <div style="margin: 25px 0;">
                      <a href="${candidate.videoInterviewLink}" 
                         style="background: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                        🎥 Start Video Interview
                      </a>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                      <p style="margin: 0; color: #856404; font-weight: bold;">⏰ This link expires on ${expiryDate.toLocaleDateString()}</p>
                    </div>
                    
                    <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                      If you have any technical issues, please contact our HR team.
                    </p>
                  </div>
                </div>
            `;

            await sendEmail({
                to: candidate.email,
                subject,
                html
            });

            console.log(`📧 Video interview invitation sent to ${candidate.email}`);
        } catch (emailError) {
            console.error('❌ Error sending video interview email:', emailError);
        }

        res.status(200).json({
            success: true,
            message: 'Video interview link generated and email sent successfully',
            candidate: {
                _id: candidate._id,
                candidateName: candidate.candidateName,
                email: candidate.email,
                videoInterviewLink: candidate.videoInterviewLink,
                videoInterviewStatus: candidate.videoInterviewStatus,
                videoInterviewExpiry: candidate.videoInterviewExpiry
            }
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Get video interview page (for candidate)
export const getVideoInterviewPage = catchAsyncError(async (req, res, next) => {
    try {
        const { token } = req.params;

        const candidate = await Candidate.findOne({ 
            videoInterviewToken: token,
            videoInterviewStatus: { $ne: 'Expired' }
        });

        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired interview link'
            });
        }

        // Check if link has expired
        if (candidate.videoInterviewExpiry && new Date() > candidate.videoInterviewExpiry) {
            candidate.videoInterviewStatus = 'Expired';
            await candidate.save();
            
            return res.status(400).json({
                success: false,
                message: 'Interview link has expired'
            });
        }

        res.status(200).json({
            success: true,
            candidate: {
                _id: candidate._id,
                candidateName: candidate.candidateName,
                department: candidate.department,
                videoInterviewStatus: candidate.videoInterviewStatus
            }
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Upload video interview
export const uploadVideoInterview = catchAsyncError(async (req, res, next) => {
    try {
        console.log('🎥 Starting video upload process...');
        
        const { token } = req.params;
        const { videoBlob, duration } = req.body;

        console.log('📋 Upload details:', {
            token: token ? 'Present' : 'Missing',
            videoBlob: videoBlob ? `${videoBlob.substring(0, 50)}...` : 'Missing',
            duration: duration
        });

        // Check AWS S3 configuration
        if (!BUCKET) {
            console.error('❌ AWS S3 Bucket not configured');
            return res.status(500).json({
                success: false,
                message: 'Video upload service not configured'
            });
        }

        const candidate = await Candidate.findOne({ 
            videoInterviewToken: token,
            videoInterviewStatus: { $ne: 'Expired' }
        });

        if (!candidate) {
            console.error('❌ Candidate not found for token:', token);
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired interview link'
            });
        }

        console.log('✅ Candidate found:', candidate.candidateName);

        // Check if link has expired
        if (candidate.videoInterviewExpiry && new Date() > candidate.videoInterviewExpiry) {
            candidate.videoInterviewStatus = 'Expired';
            await candidate.save();
            
            return res.status(400).json({
                success: false,
                message: 'Interview link has expired'
            });
        }

        // Check video duration (max 2 minutes = 120 seconds)
        if (duration > 120) {
            return res.status(400).json({
                success: false,
                message: 'Video duration exceeds 2 minutes limit'
            });
        }

        // Validate video blob
        if (!videoBlob || !videoBlob.includes('data:video/')) {
            console.error('❌ Invalid video blob format');
            return res.status(400).json({
                success: false,
                message: 'Invalid video format'
            });
        }

        console.log('🔄 Converting video blob to buffer...');
        
        // Convert base64 to buffer
        let videoBuffer;
        try {
            const base64Data = videoBlob.split(',')[1];
            if (!base64Data) {
                throw new Error('Invalid base64 data');
            }
            videoBuffer = Buffer.from(base64Data, 'base64');
            console.log('✅ Video buffer created, size:', videoBuffer.length, 'bytes');
        } catch (bufferError) {
            console.error('❌ Error converting video blob:', bufferError);
            return res.status(400).json({
                success: false,
                message: 'Error processing video data'
            });
        }
        
        // Generate unique filename
        const timestamp = Date.now();
        const filename = `video-interviews/${candidate._id}/${candidate.candidateName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.webm`;
        
        console.log('📁 Uploading to S3:', filename);
        
        // Upload to AWS S3
        const uploadParams = {
            Bucket: BUCKET,
            Key: filename,
            Body: videoBuffer,
            ContentType: 'video/webm',
            Metadata: {
                candidateId: candidate._id.toString(),
                candidateName: candidate.candidateName,
                department: candidate.department,
                duration: duration.toString(),
                uploadedAt: new Date().toISOString()
            }
        };

        console.log('🚀 Starting S3 upload...');
        let uploadResult;
        try {
            uploadResult = await s3.upload(uploadParams).promise();
            console.log('✅ S3 upload successful:', uploadResult.Location);
        } catch (s3Error) {
            console.error('❌ S3 upload failed:', s3Error);
            return res.status(500).json({
                success: false,
                message: 'Failed to upload video. Please try again.'
            });
        }

        // Update candidate with video details
        candidate.videoInterviewStatus = 'Completed';
        candidate.videoInterviewUrl = uploadResult.Location;
        await candidate.save();

        // Send confirmation email to HR
        try {
            const hrSubject = `🎥 Video Interview Completed - ${candidate.candidateName}`;
            const hrHtml = `
                <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; max-width: 600px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                  <div style="background: white; padding: 25px; border-radius: 10px; text-align: center;">
                    <h1 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 28px;">🎥 Video Interview Completed</h1>
                    <div style="background: #27ae60; color: white; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
                      <h2 style="margin: 0; font-size: 20px;">Ready for Review</h2>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                      <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Candidate Details</h3>
                      <div style="text-align: left;">
                        <p><strong style="color: #34495e;">Name:</strong> <span style="color: #7f8c8d;">${candidate.candidateName}</span></p>
                        <p><strong style="color: #34495e;">Department:</strong> <span style="color: #7f8c8d;">${candidate.department}</span></p>
                        <p><strong style="color: #34495e;">Email:</strong> <span style="color: #7f8c8d;">${candidate.email}</span></p>
                        <p><strong style="color: #34495e;">Video Duration:</strong> <span style="color: #7f8c8d;">${duration} seconds</span></p>
                        <p><strong style="color: #34495e;">Uploaded:</strong> <span style="color: #7f8c8d;">${new Date().toLocaleString()}</span></p>
                      </div>
                    </div>
                    
                    <div style="margin: 25px 0;">
                      <a href="${uploadResult.Location}" 
                         style="background: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                        🎥 Watch Video Interview
                      </a>
                    </div>
                    
                    <p style="margin-top: 20px; color: #95a5a6; font-size: 14px;">
                      Please review the video and update the candidate status accordingly.
                    </p>
                  </div>
                </div>
            `;

            // Send to HR team (you can configure HR email in environment variables)
            const hrEmail = process.env.HR_EMAIL || 'hr@company.com';
            await sendEmail({
                to: hrEmail,
                subject: hrSubject,
                html: hrHtml
            });

            console.log(`📧 Video interview completion notification sent to HR`);
        } catch (emailError) {
            console.error('❌ Error sending HR notification:', emailError);
        }

        res.status(200).json({
            success: true,
            message: 'Video interview uploaded successfully',
            videoUrl: uploadResult.Location,
            duration: duration
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Get video interview status
export const getVideoInterviewStatus = catchAsyncError(async (req, res, next) => {
    try {
        const { candidateId } = req.params;

        const candidate = await Candidate.findById(candidateId);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        res.status(200).json({
            success: true,
            videoInterview: {
                status: candidate.videoInterviewStatus,
                link: candidate.videoInterviewLink,
                url: candidate.videoInterviewUrl,
                expiry: candidate.videoInterviewExpiry
            }
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Delete video interview
export const deleteVideoInterview = catchAsyncError(async (req, res, next) => {
    try {
        const { candidateId } = req.params;

        const candidate = await Candidate.findById(candidateId);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        // Delete from S3 if exists
        if (candidate.videoInterviewUrl && candidate.videoInterviewUrl.includes('s3')) {
            try {
                const key = candidate.videoInterviewUrl.split('.com/')[1];
                await s3.deleteObject({
                    Bucket: BUCKET,
                    Key: key
                }).promise();
                console.log(`🗑️ Deleted video from S3: ${key}`);
            } catch (s3Error) {
                console.error('❌ Error deleting from S3:', s3Error);
            }
        }

        // Reset candidate video interview fields
        candidate.videoInterviewStatus = 'Pending';
        candidate.videoInterviewUrl = '';
        candidate.videoInterviewLink = '';
        candidate.videoInterviewToken = '';
        candidate.videoInterviewExpiry = null;
        
        await candidate.save();

        res.status(200).json({
            success: true,
            message: 'Video interview deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

// ✅ Test AWS S3 connectivity
export const testS3Connection = catchAsyncError(async (req, res, next) => {
    try {
        console.log('🧪 Testing AWS S3 connection...');
        
        if (!BUCKET) {
            return res.status(500).json({
                success: false,
                message: 'AWS S3 bucket not configured',
                config: {
                    bucket: 'Missing',
                    region: process.env.AWS_REGION || 'eu-north-1',
                    accessKey: process.env.AWS_ACCESS_KEY_ID ? 'Present' : 'Missing',
                    secretKey: process.env.AWS_SECRET_ACCESS_KEY ? 'Present' : 'Missing'
                }
            });
        }

        // Test S3 connection by listing objects
        const result = await s3.listObjectsV2({
            Bucket: BUCKET,
            MaxKeys: 1
        }).promise();

        res.status(200).json({
            success: true,
            message: 'AWS S3 connection successful',
            bucket: BUCKET,
            region: process.env.AWS_REGION || 'eu-north-1',
            objectCount: result.KeyCount
        });
    } catch (error) {
        console.error('❌ S3 connection test failed:', error);
        res.status(500).json({
            success: false,
            message: 'AWS S3 connection failed',
            error: error.message,
            config: {
                bucket: BUCKET || 'Missing',
                region: process.env.AWS_REGION || 'eu-north-1',
                accessKey: process.env.AWS_ACCESS_KEY_ID ? 'Present' : 'Missing',
                secretKey: process.env.AWS_SECRET_ACCESS_KEY ? 'Present' : 'Missing'
            }
        });
    }
}); 