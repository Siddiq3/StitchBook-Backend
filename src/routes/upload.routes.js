/**
 * Upload Routes
 * Clients upload image bytes directly to Supabase Storage using signed URLs.
 */

const express = require('express');
const uploadController = require('../controllers/upload.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');
const { uploadLimiter } = require('../middleware/rateLimit/limitersRedis');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

router.get(
  '/access',
  authMiddleware,
  requirePermission('shop:read'),
  uploadController.createSignedAccess
);

router.post(
  ['/sign', '/'],
  authMiddleware,
  subscriptionGate,
  uploadLimiter,
  uploadController.createSignedUpload
);

module.exports = router;
