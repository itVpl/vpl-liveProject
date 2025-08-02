// middleware/upload.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AWS from 'aws-sdk';
import multerS3 from 'multer-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGION = process.env.AWS_REGION || 'eu-north-1';
const BUCKET = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;
const isS3Configured = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && BUCKET;

// console.log("🔐 AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID);
// console.log("🧪 AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY ? "LOADED" : "MISSING");
// console.log("🌍 AWS_REGION:", process.env.AWS_REGION);
// console.log("🪣 AWS_S3_BUCKET_NAME:", process.env.AWS_S3_BUCKET_NAME);

if (!isS3Configured) {
  console.warn('⚠️ AWS S3 not configured. Falling back to local storage.');
}

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: REGION,
  signatureVersion: 'v4',
  correctClockSkew: true
});

const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${file.fieldname}_${Date.now()}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.test(ext)) cb(null, true);
  else cb(new Error('Only JPG, PNG, and PDF files are allowed.'));
};

const getS3Storage = (prefixBuilder) => {
  if (!isS3Configured) return localStorage;

  return multerS3({
    s3,
    bucket: BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    contentDisposition: 'inline',
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = `${prefixBuilder(req)}/${file.fieldname}_${Date.now()}${ext}`;
      cb(null, filename);
    }
  });
};

const employeeUpload = multer({
  storage: getS3Storage(req => `employeeData/${req.body.empId || 'unknown'}`),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const shipperTruckerUpload = multer({ 
  storage: getS3Storage(req => `shipperTruckerData/${(req.body.compName || 'unknown').replace(/[^a-z0-9]/gi, '_')}`),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const proofOfDeliveryUpload = multer({
  storage: getS3Storage(req => `proofOfDelivery/${req.params.id || 'unknown'}`),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const arrivalUpload = multer({
  storage: getS3Storage(() => `arrivalUploads`),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).fields([
  { name: 'vehicleEmptyImg', maxCount: 5 },
  { name: 'vehicleLoadedImg', maxCount: 5 },
  { name: 'POD', maxCount: 5 },
  { name: 'EIRticketImg', maxCount: 5 },
  { name: 'Seal', maxCount: 5 }
]);

// Driver image upload configurations - Optional files
const driverPickupUpload = multer({
  storage: getS3Storage(req => `driverImages/${req.params.shipmentNumber || 'unknown'}/pickup`),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).any(); // Accept any files

const driverLoadedUpload = multer({
  storage: getS3Storage(req => `driverImages/${req.params.shipmentNumber || 'unknown'}/loaded`),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).any(); // Accept any files

const driverPODUpload = multer({
  storage: getS3Storage(req => `driverImages/${req.params.shipmentNumber || 'unknown'}/pod`),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).fields([
  { name: 'podImages', maxCount: 10 },
  { name: 'pod', maxCount: 10 },
  { name: 'proofOfDelivery', maxCount: 10 }
]);

const driverDropLocationUpload = multer({
  storage: getS3Storage(req => `driverImages/${req.params.shipmentNumber || 'unknown'}/dropLocation`),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).fields([
  { name: 'podImages', maxCount: 10 },
  { name: 'loadedTruckImages', maxCount: 10 },
  { name: 'dropLocationImages', maxCount: 10 },
  { name: 'emptyTruckImages', maxCount: 10 }
]);

const chatFileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.test(ext)) cb(null, true);
  else cb(new Error('Only JPG, PNG, and PDF files are allowed.'));
};

const chatFileUpload = multer({
  storage: isS3Configured ? multerS3({
    s3,
    bucket: BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    contentDisposition: 'inline',
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const senderName = req.user?.name || req.user?.empId || 'unknown';
      const cleanSenderName = senderName.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = Date.now();
      const filename = `chatFiles/${cleanSenderName}/${cleanSenderName}_${timestamp}${ext}`;
      cb(null, filename);
    }
  }) : multer.diskStorage({
    destination: (req, file, cb) => {
      const senderName = req.user?.name || req.user?.empId || 'unknown';
      const cleanSenderName = senderName.replace(/[^a-zA-Z0-9]/g, '_');
      const uploadPath = path.join(__dirname, '../uploads/chatFiles', cleanSenderName);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const senderName = req.user?.name || req.user?.empId || 'unknown';
      const cleanSenderName = senderName.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = Date.now();
      const fileName = `${cleanSenderName}_${timestamp}${ext}`;
      cb(null, fileName);
    }
  }),
  fileFilter: chatFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const driverRegisterUpload = multer({
  storage: getS3Storage(req => `driverRegisterUploads/${req.body.mcDot || 'unknown'}`),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).fields([
  { name: 'driverPhoto', maxCount: 1 },
  { name: 'cdlDocument', maxCount: 1 }
]);

// 🔥 NEW: Multiple document upload for CMT users adding shipper_driver
const cmtDocumentUpload = multer({
  storage: isS3Configured ? getS3Storage(req => `cmtDocuments/${(req.body.compName || 'unknown').replace(/[^a-z0-9]/gi, '_')}`) : multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../uploads/cmtDocuments');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const fileName = `${file.fieldname}_${timestamp}${ext}`;
      cb(null, fileName);
    }
  }),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).fields([
  { name: 'brokeragePacket', maxCount: 1 },
  { name: 'carrierPartnerAgreement', maxCount: 1 },
  { name: 'w9Form', maxCount: 1 },
  { name: 'mcAuthority', maxCount: 1 },
  { name: 'safetyLetter', maxCount: 1 },
  { name: 'bankingInfo', maxCount: 1 },
  { name: 'inspectionLetter', maxCount: 1 },
  { name: 'insurance', maxCount: 1 },
  { name: 'docUpload', maxCount: 1 } // Keep existing single document upload for backward compatibility
]);

// 🔥 NEW: DO document upload middleware
const doDocumentUpload = multer({
  storage: isS3Configured ? getS3Storage(req => `doDocuments/${req.params.doId || 'unknown'}`) : multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../uploads/doDocuments');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const fileName = `${file.fieldname}_${timestamp}${ext}`;
      cb(null, fileName);
    }
  }),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).fields([
  { name: 'invoice', maxCount: 5 },
  { name: 'contract', maxCount: 5 },
  { name: 'bill_of_lading', maxCount: 5 },
  { name: 'other', maxCount: 10 }
]);

// 🔥 NEW: Simple single file upload for DO
const doSingleFileUpload = multer({
  storage: isS3Configured ? getS3Storage(req => `doDocuments/${req.params.doId || 'unknown'}`) : multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../uploads/doDocuments');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const fileName = `document_${timestamp}${ext}`;
      cb(null, fileName);
    }
  }),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).single('document');

// 🔥 NEW: DO file upload with LOAD NO folder structure
const doFileUpload = multer({
  storage: isS3Configured ? getS3Storage(req => {
    // Extract LOAD NO from request body or params
    const loadNo = req.body.loadNo || req.params.loadNo || 'unknown';
    return `doFiles/${loadNo}`;
  }) : multer.diskStorage({
    destination: (req, file, cb) => {
      const loadNo = req.body.loadNo || req.params.loadNo || 'unknown';
      const uploadPath = path.join(__dirname, '../uploads/doFiles', loadNo);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const fileName = `${file.fieldname}_${timestamp}${ext}`;
      cb(null, fileName);
    }
  }),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).fields([
  { name: 'invoice', maxCount: 5 },
  { name: 'contract', maxCount: 5 },
  { name: 'bill_of_lading', maxCount: 5 },
  { name: 'other', maxCount: 10 }
]);

// 🔥 NEW: Simple single file upload for DO creation
const doCreateUpload = multer({
  storage: isS3Configured ? getS3Storage(req => {
    // Extract LOAD NO from request body - handle both JSON and form data
    let loadNo = 'unknown';
    
    // Try to get loadNo from form data first
    if (req.body.customers) {
      try {
        const customers = JSON.parse(req.body.customers);
        if (customers && customers.length > 0 && customers[0].loadNo) {
          loadNo = customers[0].loadNo;
        }
      } catch (e) {
        console.log('Could not parse customers JSON');
      }
    }
    
    // Fallback to direct loadNo field
    if (loadNo === 'unknown' && req.body.loadNo) {
      loadNo = req.body.loadNo;
    }
    
    console.log('Using loadNo for folder:', loadNo);
    return `doFiles/${loadNo}`;
  }) : multer.diskStorage({
    destination: (req, file, cb) => {
      let loadNo = 'unknown';
      
      // Try to get loadNo from form data first
      if (req.body.customers) {
        try {
          const customers = JSON.parse(req.body.customers);
          if (customers && customers.length > 0 && customers[0].loadNo) {
            loadNo = customers[0].loadNo;
          }
        } catch (e) {
          console.log('Could not parse customers JSON');
        }
      }
      
      // Fallback to direct loadNo field
      if (loadNo === 'unknown' && req.body.loadNo) {
        loadNo = req.body.loadNo;
      }
      
      console.log('Using loadNo for folder:', loadNo);
      const uploadPath = path.join(__dirname, '../uploads/doFiles', loadNo);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const fileName = `document_${timestamp}${ext}`;
      cb(null, fileName);
    }
  }),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).single('document');

const getS3Url = (key) => {
  if (!key || !isS3Configured) return '';
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
};

const normalizePath = (pathStr) => {
  if (!pathStr) return '';
  if (pathStr.startsWith('http')) return pathStr;
  if (isS3Configured && /employeeData|arrivalUploads|proofOfDelivery/.test(pathStr)) return getS3Url(pathStr);
  return pathStr;
};

const normalizeShipperTruckerPath = (pathStr) => {
  if (!pathStr) return '';
  if (pathStr.startsWith('http')) return pathStr;
  if (isS3Configured && pathStr.includes('shipperTruckerData')) return getS3Url(pathStr);
  return pathStr;
};

const normalizeCMTDocumentPath = (pathStr) => {
  if (!pathStr) return '';
  if (pathStr.startsWith('http')) return pathStr;
  if (isS3Configured && pathStr.includes('cmtDocuments')) return getS3Url(pathStr);
  return pathStr;
};

const normalizeChatFilePath = (pathStr) => {
  if (!pathStr) return '';
  if (pathStr.startsWith('http')) return pathStr;
  if (isS3Configured && pathStr.includes('chatFiles')) return getS3Url(pathStr);
  return pathStr;
};

export {
  normalizePath,
  normalizeShipperTruckerPath,
  normalizeCMTDocumentPath,
  normalizeChatFilePath,
  employeeUpload,
  shipperTruckerUpload,
  proofOfDeliveryUpload,
  arrivalUpload,
  driverPickupUpload,
  driverLoadedUpload,
  driverPODUpload,
  driverDropLocationUpload,
  getS3Url,
  chatFileUpload,
  driverRegisterUpload,
  cmtDocumentUpload,
  doDocumentUpload,
  doSingleFileUpload,
  doFileUpload,
  doCreateUpload
};
