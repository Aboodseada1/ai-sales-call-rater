const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '15') * 1024 * 1024;

const ALLOWED_FORMATS = ['mp3', 'wav', 'ogg', 'mp4', 'webm', 'm4a'];

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    const uniqueName = `${uuidv4()}.${ext}`;
    cb(null, uniqueName);
  }
});

// File filter for allowed formats
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  
  // Check MIME type and extension
  const allowedMimes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave',
    'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/x-m4a',
    'audio/m4a', 'video/webm'
  ];
  
  if (ALLOWED_FORMATS.includes(ext) || allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file format. Allowed: ${ALLOWED_FORMATS.join(', ')}`), false);
  }
};

// Multer upload instance
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter
});

/**
 * Get audio format from file extension
 */
function getAudioFormat(filename) {
  const ext = path.extname(filename).toLowerCase().slice(1);
  // Map extensions to standard formats
  const formatMap = {
    'mp3': 'mp3',
    'wav': 'wav',
    'ogg': 'ogg',
    'mp4': 'mp4',
    'm4a': 'mp4',
    'webm': 'webm'
  };
  return formatMap[ext] || ext;
}

/**
 * Read audio file and convert to base64
 */
async function audioToBase64(filePath) {
  const fileBuffer = await fs.promises.readFile(filePath);
  return fileBuffer.toString('base64');
}

/**
 * Delete audio file from disk
 */
async function deleteAudioFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to delete audio file: ${filePath}`, error);
    return false;
  }
}

/**
 * Get file info
 */
function getFileInfo(file) {
  return {
    originalName: file.originalname,
    path: file.path,
    format: getAudioFormat(file.originalname),
    size: file.size
  };
}

module.exports = {
  upload,
  getAudioFormat,
  audioToBase64,
  deleteAudioFile,
  getFileInfo,
  ALLOWED_FORMATS,
  MAX_FILE_SIZE
};
