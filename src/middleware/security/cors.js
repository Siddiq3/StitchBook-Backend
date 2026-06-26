/**
 * CORS middleware configuration
 * Uses environment-driven origin whitelist and rejects unauthorized origins.
 */

const cors = require('cors');

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
    .map((item) => item.trim())
    .filter(Boolean);
};

const allowedOrigins = getAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS policy: This origin is not allowed')); 
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-client-platform'],
};

module.exports = cors(corsOptions);
