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

console.log("🔐 AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID);
console.log("🧪 AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY ? "LOADED" : "MISSING");
console.log("🌍 AWS_REGION:", process.env.AWS_REGION);
console.log("🪣 AWS_S3_BUCKET_NAME:", process.env.AWS_S3_BUCKET_NAME);

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
  limits: { fileSize: 50 * 1024 * 1024 }
});

const shipperTruckerUpload = multer({
  storage: getS3Storage(req => `shipperTruckerData/${(req.body.compName || 'unknown').replace(/[^a-z0-9]/gi, '_')}`),
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const proofOfDeliveryUpload = multer({
  storage: getS3Storage(req => `proofOfDelivery/${req.params.id || 'unknown'}`),
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const arrivalUpload = multer({
  storage: getS3Storage(() => `arrivalUploads`),
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
}).fields([
  { name: 'vehicleEmptyImg', maxCount: 5 },
  { name: 'vehicleLoadedImg', maxCount: 5 },
  { name: 'POD', maxCount: 5 },
  { name: 'EIRticketImg', maxCount: 5 },
  { name: 'Seal', maxCount: 5 }
]);

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

export {
  normalizePath,
  normalizeShipperTruckerPath,
  employeeUpload,
  shipperTruckerUpload,
  proofOfDeliveryUpload,
  arrivalUpload,
  getS3Url
};
