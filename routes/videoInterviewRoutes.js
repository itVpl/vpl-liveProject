import express from 'express';
import {
    generateVideoInterviewLink,
    getVideoInterviewPage,
    uploadVideoInterview,
    getVideoInterviewStatus,
    deleteVideoInterview,
    testS3Connection
} from '../controllers/videoInterviewController.js';
import { isAuthenticatedUser } from '../middlewares/auth.js';

const videoInterviewRouter = express.Router();

// ✅ Generate video interview link (HR/Admin only)
videoInterviewRouter.post('/generate/:candidateId', 
    isAuthenticatedUser, 
    generateVideoInterviewLink
);

// ✅ Get video interview page (for candidate - no auth required)
videoInterviewRouter.get('/page/:token', 
    getVideoInterviewPage
);

// ✅ Upload video interview (for candidate - no auth required)
videoInterviewRouter.post('/upload/:token', 
    uploadVideoInterview
);

// ✅ Get video interview status
videoInterviewRouter.get('/status/:candidateId', 
    isAuthenticatedUser, 
    getVideoInterviewStatus
);

// ✅ Delete video interview
videoInterviewRouter.delete('/:candidateId', 
    isAuthenticatedUser, 
    deleteVideoInterview
);

// ✅ Test AWS S3 connection
videoInterviewRouter.get('/test/s3', 
    testS3Connection
);

export default videoInterviewRouter; 