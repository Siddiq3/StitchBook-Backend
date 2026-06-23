/**
 * Token Service
 * Handles JWT token generation, verification, and refresh logic
 * Production-ready token management with proper expiry and security
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m'; // Short-lived access tokens for production
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your_super_secret_refresh_key';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '90d'; // Trusted device session window

/**
 * Generate JWT token for authenticated user
 * Used to keep users logged in (similar to Swiggy app)
 *
 * @param {object} payload - Token payload { userId, phone, ... }
 * @returns {string} - JWT token
 */
const generateAccessToken = (payload) => {
  try {
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
      algorithm: 'HS256',
    });

    logger.info(`✓ Access token generated for user: ${payload.userId}`);
    return token;
  } catch (error) {
    logger.error('Token generation error:', error.message);
    throw new Error(`Failed to generate token: ${error.message}`);
  }
};

/**
 * Generate refresh token (optional - for advanced scenarios)
 * Can be used to get a new access token without re-login
 *
 * @param {object} payload - Token payload { userId, phone }
 * @returns {string} - Refresh JWT token
 */
const generateRefreshToken = (payload) => {
  try {
    const token = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRY,
      algorithm: 'HS256',
    });

    logger.info(`✓ Refresh token generated for user: ${payload.userId}`);
    return token;
  } catch (error) {
    logger.error('Refresh token generation error:', error.message);
    throw new Error(`Failed to generate refresh token: ${error.message}`);
  }
};

/**
 * Verify and decode JWT token
 * Used by middleware to validate incoming tokens
 *
 * @param {string} token - JWT token to verify
 * @returns {object} - Decoded token payload { userId, phone, iat, exp }
 * @throws {Error} - If token is invalid or expired
 */
const verifyAccessToken = (token) => {
  try {
    if (!token) {
      throw new Error('Token is required');
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });

    if (decoded.tokenType !== 'access') {
      throw new Error('Invalid access token');
    }

    logger.info(`✓ Access token verified for user: ${decoded.userId}`);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token expired');
      throw new Error('Token has expired. Please login again.');
    }
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid token');
      throw new Error('Invalid token');
    }
    logger.error('Token verification error:', error.message);
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

/**
 * Verify refresh token
 * Used when user wants to get a new access token
 *
 * @param {string} token - Refresh token to verify
 * @returns {object} - Decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
const verifyRefreshToken = (token) => {
  try {
    if (!token) {
      throw new Error('Refresh token is required');
    }

    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
    });

    if (decoded.tokenType !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    logger.info(`✓ Refresh token verified for user: ${decoded.userId}`);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Refresh token expired');
      throw new Error('Refresh token has expired. Please login again.');
    }
    logger.error('Refresh token verification error:', error.message);
    throw new Error(`Refresh token verification failed: ${error.message}`);
  }
};

/**
 * Decode token WITHOUT verification (for debugging only)
 * WARNING: Use only for testing/logging purposes
 *
 * @param {string} token - JWT token
 * @returns {object} - Decoded payload (may be expired)
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.error('Token decode error:', error.message);
    return null;
  }
};

/**
 * Extract userId from token
 * Helper method for quick access to user ID
 *
 * @param {string} token - JWT token
 * @returns {string} - User ID
 */
const getUserIdFromToken = (token) => {
  try {
    const decoded = verifyAccessToken(token);
    return decoded.userId;
  } catch (error) {
    logger.error('Error extracting userId from token:', error.message);
    throw error;
  }
};

/**
 * Check if token is about to expire (within 24 hours)
 * Can be used to proactively refresh tokens
 *
 * @param {string} token - JWT token
 * @returns {boolean} - True if token expires within 24 hours
 */
const isTokenExpiringSoon = (token) => {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = decoded.exp - now;
    const oneDay = 24 * 60 * 60;

    return expiresIn < oneDay;
  } catch (error) {
    return true; // Assume expiring if we can't decode
  }
};

/**
 * Generate complete token response for login
 * Returns both access and refresh tokens with metadata
 *
 * @param {object} userPayload - User data { userId, phone, name, sessionId }
 * @returns {object} - { accessToken, refreshToken, expiresIn, user }
 */
const generateTokenPair = (userPayload) => {
  try {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const accessToken = generateAccessToken({
      userId: userPayload.userId,
      phone: userPayload.phone,
      email: userPayload.email || null,
      name: userPayload.name || null,
      sessionId: userPayload.sessionId,
      jti: accessJti,
      tokenType: 'access',
    });

    const refreshToken = generateRefreshToken({
      userId: userPayload.userId,
      phone: userPayload.phone,
      email: userPayload.email || null,
      name: userPayload.name || null,
      sessionId: userPayload.sessionId,
      jti: refreshJti,
      tokenType: 'refresh',
    });

    const decoded = decodeToken(accessToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: decoded.exp - Math.floor(Date.now() / 1000), // seconds until expiry
      tokenType: 'Bearer',
      sessionId: userPayload.sessionId,
      accessJti,
      refreshJti,
      user: {
        userId: userPayload.userId,
        phone: userPayload.phone,
        email: userPayload.email || null,
        name: userPayload.name || null,
      },
    };
  } catch (error) {
    logger.error('Error generating token pair:', error.message);
    throw error;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  getUserIdFromToken,
  isTokenExpiringSoon,
  generateTokenPair,
  JWT_EXPIRY,
  JWT_REFRESH_EXPIRY,
};
