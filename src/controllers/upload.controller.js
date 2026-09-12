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

    const authenticatedShopId = req.user?.shop_id ?? req.user?.shopId;
    if (authenticatedShopId === undefined || authenticatedShopId === null || authenticatedShopId === '') {
      return responder.error(res, 403, 'Authenticated shop context is required');
    }

    const configuredBaseUrl =
      process.env.BASE_URL ||
      (process.env.NODE_ENV === 'production' ? null : 'http://localhost:5002');

    if (!configuredBaseUrl) {
      return responder.error(res, 500, 'BASE_URL is not configured');
    }

    const fileUrl = `${String(configuredBaseUrl).replace(/\/$/, '')}/uploads/${authenticatedShopId}/${req.file.filename}`;

    logger.info(`File uploaded for shop ${authenticatedShopId}: ${req.file.filename}`);
    responder.success(res, 201, 'File uploaded successfully', { url: fileUrl });
  } catch (error) {
    logger.warn('File upload failed:', error.message);
    responder.error(res, 500, process.env.NODE_ENV === 'production' ? 'File upload failed' : error.message);
  }
};
