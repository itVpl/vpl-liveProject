import express from 'express';
import {
    createCandidate,
    getAllCandidates,
    getCandidateById,
    updateCandidateStatus,
    updateCandidate,
    deleteCandidate,
    getCandidateStats,
    scheduleInterview,
    bulkStatusUpdate
} from '../controllers/candidateController.js';
import { isAuthenticatedUser } from '../middlewares/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create upload middleware for candidate resumes
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../uploads/resumes');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const fileName = `resume_${timestamp}${ext}`;
      cb(null, fileName);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed for resumes.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const candidateRouter = express.Router();

// ✅ Create a new candidate (with resume upload)
candidateRouter.post('/create', 
    isAuthenticatedUser, 
    upload.single('resume'), 
    createCandidate
);

// ✅ Create a new candidate (without resume upload - for testing)
candidateRouter.post('/create-simple', 
    isAuthenticatedUser, 
    createCandidate
);

// ✅ Get all candidates with filtering and pagination
candidateRouter.get('/all', 
    isAuthenticatedUser, 
    getAllCandidates
);

// ✅ Get candidate by ID
candidateRouter.get('/:id', 
    isAuthenticatedUser, 
    getCandidateById
);

// ✅ Update candidate status
candidateRouter.put('/:id/status', 
    isAuthenticatedUser, 
    updateCandidateStatus
);

// ✅ Update candidate details (with resume upload)
candidateRouter.put('/:id', 
    isAuthenticatedUser, 
    upload.single('resume'), 
    updateCandidate
);

// ✅ Delete candidate
candidateRouter.delete('/:id', 
    isAuthenticatedUser, 
    deleteCandidate
);

// ✅ Get candidate statistics
candidateRouter.get('/stats/overview', 
    isAuthenticatedUser, 
    getCandidateStats
);

// ✅ Schedule interview
candidateRouter.post('/:id/schedule-interview', 
    isAuthenticatedUser, 
    scheduleInterview
);

// ✅ Bulk status update
candidateRouter.put('/bulk/status', 
    isAuthenticatedUser, 
    bulkStatusUpdate
);

export default candidateRouter; 