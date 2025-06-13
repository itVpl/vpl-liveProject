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

const normalizePath = (filePath) => {
  const relBase = 'uploads' + path.sep + 'employeeData';
  const idx = filePath.indexOf(relBase);
  let relPath = filePath;
  if (idx !== -1) {
    relPath = filePath.substring(idx);
  }
  return relPath.split(path.sep).join('/');
};
export { normalizePath };

export default employeeUpload;
