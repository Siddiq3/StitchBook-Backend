/**
 * Central environment validation for required runtime configuration.
 * Secrets are required at startup and must never fall back to hardcoded values.
 */

const getRequiredEnv = (name) => {
  const value = process.env[name];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required`);
  }

  return value.trim();
};

const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const JWT_REFRESH_SECRET = getRequiredEnv('JWT_REFRESH_SECRET');

module.exports = {
  getRequiredEnv,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EXPIRY: process.env.JWT_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '90d',
  DATABASE_URL: process.env.DATABASE_URL || '',
};
