const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

const MIME_TO_EXT = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
});

const getConfig = () => {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const bucket = String(process.env.SUPABASE_STORAGE_BUCKET || 'stitchbook-private').trim();
  const maxBytes = Math.max(1024, Number(process.env.SUPABASE_STORAGE_MAX_BYTES || 10 * 1024 * 1024));

  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    const error = new Error('Storage service is not configured');
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }

  return {
    storageBaseUrl: `${supabaseUrl}/storage/v1`,
    serviceRoleKey,
    bucket,
    maxBytes,
  };
};

const encodePath = (value) => String(value)
  .split('/')
  .filter(Boolean)
  .map((part) => encodeURIComponent(part))
  .join('/');

const storageRequest = async (method, endpoint, body) => {
  const { storageBaseUrl, serviceRoleKey } = getConfig();

  try {
    const response = await axios({
      method,
      url: `${storageBaseUrl}${endpoint}`,
      data: body,
      timeout: 10000,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    logger.warn('Supabase Storage request failed', {
      status: error.response?.status || null,
      code: error.code || null,
    });
    const storageError = new Error('Storage service is temporarily unavailable');
    storageError.code = 'STORAGE_REQUEST_FAILED';
    storageError.status = 503;
    throw storageError;
  }
};

const assertShopId = (shopId) => {
  const normalized = Number(shopId);
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    const error = new Error('Authenticated shop context is required');
    error.status = 403;
    throw error;
  }
  return normalized;
};

const assertOwnedPath = (shopId, objectPath) => {
  const normalizedShopId = assertShopId(shopId);
  const normalizedPath = String(objectPath || '').replace(/^\/+/, '');
  const prefix = `shops/${normalizedShopId}/`;
  const filename = normalizedPath.slice(prefix.length);

  if (
    !normalizedPath.startsWith(prefix) ||
    filename.includes('/') ||
    !/^[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|gif|webp)$/i.test(filename)
  ) {
    const error = new Error('File not found');
    error.status = 404;
    throw error;
  }

  return normalizedPath;
};

exports.createSignedUpload = async ({ shopId, mimeType, sizeBytes }) => {
  const normalizedShopId = assertShopId(shopId);
  const normalizedMime = String(mimeType || '').toLowerCase();
  const extension = MIME_TO_EXT[normalizedMime];
  const { storageBaseUrl, bucket, maxBytes } = getConfig();
  const numericSize = Number(sizeBytes);

  if (!extension) {
    const error = new Error('Only JPG, PNG, GIF and WEBP images are allowed');
    error.status = 400;
    throw error;
  }
  if (Number.isFinite(numericSize) && numericSize > maxBytes) {
    const error = new Error('Image is too large');
    error.status = 413;
    throw error;
  }

  const objectPath = `shops/${normalizedShopId}/${crypto.randomUUID()}.${extension}`;
  const data = await storageRequest(
    'post',
    `/object/upload/sign/${encodePath(bucket)}/${encodePath(objectPath)}`,
    {}
  );

  if (!data?.url) {
    const error = new Error('Storage service returned an invalid upload URL');
    error.code = 'STORAGE_INVALID_RESPONSE';
    error.status = 503;
    throw error;
  }

  const uploadUrl = `${storageBaseUrl}${data.url}`;
  const token = new URL(uploadUrl).searchParams.get('token');

  return {
    bucket,
    path: objectPath,
    uploadUrl,
    token,
    expiresIn: 7200,
    maxBytes,
    contentType: normalizedMime,
  };
};

exports.createSignedReadUrl = async ({ shopId, objectPath, expiresIn = 300 }) => {
  const ownedPath = assertOwnedPath(shopId, objectPath);
  const { storageBaseUrl, bucket } = getConfig();
  const safeExpiry = Math.max(60, Math.min(900, Number(expiresIn) || 300));

  const data = await storageRequest(
    'post',
    `/object/sign/${encodePath(bucket)}/${encodePath(ownedPath)}`,
    { expiresIn: safeExpiry }
  );

  if (!data?.signedURL) {
    const error = new Error('Storage service returned an invalid access URL');
    error.code = 'STORAGE_INVALID_RESPONSE';
    error.status = 503;
    throw error;
  }

  return {
    url: `${storageBaseUrl}${data.signedURL}`,
    path: ownedPath,
    expiresIn: safeExpiry,
  };
};

exports.deleteShopFiles = async (shopIds, maxObjects = 100) => {
  const { bucket } = getConfig();
  let budget = Math.max(1, Math.min(100, Number(maxObjects) || 100));

  for (const shopId of shopIds || []) {
    const normalizedShopId = assertShopId(shopId);
    const prefix = `shops/${normalizedShopId}`;

    while (budget > 0) {
      const limit = Math.min(100, budget);
      const listed = await storageRequest(
        'post',
        `/object/list/${encodePath(bucket)}`,
        { prefix, limit, offset: 0, sortBy: { column: 'name', order: 'asc' } }
      );

      const objectPaths = (Array.isArray(listed) ? listed : [])
        .filter((item) => item?.name && item?.id)
        .map((item) => `${prefix}/${item.name}`);

      if (objectPaths.length === 0) break;

      await storageRequest(
        'delete',
        `/object/${encodePath(bucket)}`,
        { prefixes: objectPaths }
      );

      budget -= objectPaths.length;
      if (budget === 0) return false;
      if (objectPaths.length < limit) break;
    }
  }

  return true;
};

exports.assertOwnedPath = assertOwnedPath;
exports.getConfig = getConfig;
