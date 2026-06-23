/**
 * Upload Routes
 * File upload endpoints
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const uploadController = require('../controllers/upload.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');
const { uploadLimiter } = require('../middleware/rateLimit/limitersRedis');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// POST /upload - Upload an image file (authenticated)
router.post('/', authMiddleware, subscriptionGate, uploadLimiter, upload.single('image'), uploadController.uploadImage);

module.exports = router;
