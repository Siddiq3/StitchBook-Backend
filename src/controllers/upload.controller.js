/**
 * Upload Controller
 * Handles file upload operations
 */

const responder = require('../utils/responder');
const logger = require('../utils/logger');

/**
 * POST /upload
 * Upload an image file and return its URL
 */
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return responder.error(res, 400, 'No file uploaded');
    }

    // Get file URL based on storage method
    const fileUrl = `${process.env.BASE_URL || 'http://localhost:5002'}/uploads/${req.file.filename}`;

    logger.info(`File uploaded: ${req.file.filename}`);
    responder.success(res, 201, 'File uploaded successfully', { url: fileUrl });
  } catch (error) {
    logger.warn('File upload failed:', error.message);
    responder.error(res, 500, process.env.NODE_ENV === 'production' ? 'File upload failed' : error.message);
  }
};
