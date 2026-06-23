/**
 * JWT Configuration and Utilities
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Generate JWT token
 * @param {object} payload - Data to encode in token (usually user ID)
 * @returns {string} - JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {object} - Decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

/**
 * Decode token without verification (for debugging)
 * @param {string} token - JWT token
 * @returns {object} - Decoded token payload
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  JWT_SECRET,
  JWT_EXPIRY,
};
