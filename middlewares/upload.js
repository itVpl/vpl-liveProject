import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUploadPath = path.join(__dirname, '../uploads/employeeData');
if (!fs.existsSync(baseUploadPath)) {
  fs.mkdirSync(baseUploadPath, { recursive: true });
}

// 🔥 New: Shipper/Trucker upload path
const shipperTruckerBasePath = path.join(__dirname, '../uploads/shipperTruckerData');
if (!fs.existsSync(shipperTruckerBasePath)) {
  fs.mkdirSync(shipperTruckerBasePath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Try to get empId from multiple places
    let empId =
      req.body.empId ||
      (req.query && req.query.empId) ||
      (req.headers && req.headers.empid) ||
      (req.params && (req.params.empId || req.params.id));
    if (!empId) {
      // fallback: use 'unknown' + timestamp
      empId = 'unknown_' + Date.now();
    }
    const empFolder = path.join(baseUploadPath, empId);
    if (!fs.existsSync(empFolder)) {
      fs.mkdirSync(empFolder, { recursive: true });
    }
    cb(null, empFolder);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    // Use fieldname for clarity (e.g. pancard, aadharcard, educationalDocs)
    const filename = `${file.fieldname}_${Date.now()}${ext}`;
    cb(null, filename);
  },
});

// 🔥 New: Shipper/Trucker storage
const shipperTruckerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Get company name or email for folder name
    let folderName = req.body.compName || req.body.email || 'unknown';
    
    // Clean folder name (remove special characters)
    folderName = folderName.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Add userType to folder name
    const userType = req.body.userType || 'unknown';
    const finalFolderName = `${userType}_${folderName}`;
    
    const companyFolder = path.join(shipperTruckerBasePath, finalFolderName);
    if (!fs.existsSync(companyFolder)) {
      fs.mkdirSync(companyFolder, { recursive: true });
    }
    cb(null, companyFolder);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    const filename = `${file.fieldname}_${timestamp}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|jpg|jpeg|png/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and image files are allowed.'));
  }
};

const employeeUpload = multer({ storage, fileFilter });
const shipperTruckerUpload = multer({ storage: shipperTruckerStorage, fileFilter });

const normalizePath = (filePath) => {
  const relBase = 'uploads' + path.sep + 'employeeData';
  const idx = filePath.indexOf(relBase);
  let relPath = filePath;
  if (idx !== -1) {
    relPath = filePath.substring(idx);
  }
  return relPath.split(path.sep).join('/');
};

// 🔥 New: Normalize shipper/trucker path
const normalizeShipperTruckerPath = (filePath) => {
  const relBase = 'uploads' + path.sep + 'shipperTruckerData';
  const idx = filePath.indexOf(relBase);
  let relPath = filePath;
  if (idx !== -1) {
    relPath = filePath.substring(idx);
  }
  return relPath.split(path.sep).join('/');
};

// Proof of Delivery storage for loads
const proofOfDeliveryBasePath = path.join(__dirname, '../uploads/proofOfDelivery');
if (!fs.existsSync(proofOfDeliveryBasePath)) {
  fs.mkdirSync(proofOfDeliveryBasePath, { recursive: true });
}

const proofOfDeliveryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const loadId = req.params.id || 'unknown_' + Date.now();
    const loadFolder = path.join(proofOfDeliveryBasePath, loadId);
    if (!fs.existsSync(loadFolder)) {
      fs.mkdirSync(loadFolder, { recursive: true });
    }
    cb(null, loadFolder);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `${file.fieldname}_${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const proofOfDeliveryUpload = multer({ storage: proofOfDeliveryStorage, fileFilter });

export { normalizePath, normalizeShipperTruckerPath };
export { shipperTruckerUpload, proofOfDeliveryUpload };
export default employeeUpload;
