/**
 * Upload Controller
 * Creates time-limited Supabase Storage URLs without proxying image bytes.
 */

const responder = require('../utils/responder');
const logger = require('../utils/logger');
const StorageService = require('../services/storage.service');

const getShopId = (req) => req.user?.shop_id ?? req.user?.shopId;

exports.createSignedUpload = async (req, res) => {
  try {
    const { mimeType, size } = req.body || {};
    if (!mimeType) {
      return responder.error(res, 400, 'mimeType is required');
    }

    const result = await StorageService.createSignedUpload({
      shopId: getShopId(req),
      mimeType,
      sizeBytes: size,
    });

    responder.success(res, 201, 'Upload URL created', result);
  } catch (error) {
    logger.warn('Create upload URL failed', { code: error.code || null });
    responder.error(
      res,
      error.status || 500,
      process.env.NODE_ENV === 'production' ? 'Unable to prepare image upload' : error.message
    );
  }
};

exports.createSignedAccess = async (req, res) => {
  try {
    const result = await StorageService.createSignedReadUrl({
      shopId: getShopId(req),
      objectPath: req.query.path,
      expiresIn: 300,
    });

    responder.success(res, 200, 'File access URL created', result);
  } catch (error) {
    logger.warn('Create file access URL failed', { code: error.code || null });
    responder.error(
      res,
      error.status || 500,
      process.env.NODE_ENV === 'production' ? 'Unable to access image' : error.message
    );
  }
};
