/**
 * CORS middleware configuration
 * Uses environment-driven origin whitelist and rejects unauthorized origins.
 */

const cors = require('cors');

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/$/, '');

const getAllowedOrigins = () => {
  const raw = process.env.FRONTEND_URLS || process.env.FRONTEND_URL;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      return [];
    }

    return [
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:5173',
      'http://localhost:8081',
      'http://192.168.1.44:5173',
    ];
  }

  return raw
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
};

const allowedOrigins = getAllowedOrigins();
const allowedOriginSet = new Set(allowedOrigins);

const getAllowedVercelProjects = () => {
  const raw = process.env.VERCEL_PROJECT_ORIGINS || '';
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const allowedVercelProjects = getAllowedVercelProjects();

const allowedNativeOrigins = new Set([
  'app://stitchbook',
  'stitchbook://',
  'com.stitchbook.app://',
  'capacitor://localhost',
  'ionic://localhost',
]);

const isAllowedExpoOrigin = (origin) => /^exp:\/\/|^exps:\/\//.test(origin);

const isAllowedVercelPreview = (origin) => {
  if (allowedVercelProjects.length === 0) {
    return false;
  }

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:' || !hostname.endsWith('.vercel.app')) {
      return false;
    }

    return allowedVercelProjects.some((project) => hostname.startsWith(`${project}-`));
  } catch (error) {
    return false;
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (
      allowedOriginSet.has(normalizedOrigin) ||
      allowedNativeOrigins.has(normalizedOrigin) ||
      isAllowedExpoOrigin(normalizedOrigin) ||
      isAllowedVercelPreview(normalizedOrigin)
    ) {
      return callback(null, true);
    }

    return callback(new Error(`CORS policy: This origin is not allowed (${normalizedOrigin})`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-client-platform'],
};

module.exports = cors(corsOptions);
