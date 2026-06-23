/**
 * Rate limiting middleware definitions
 */

const rateLimit = require('express-rate-limit');
const logger = require('../../utils/logger');

const createLimiter = ({ windowMs, max, message }) => rateLimit({
  windowMs,
  max,
  message,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const requestId = req.requestId || 'unknown';
    const userId = req.user ? req.user.userId : 'anonymous';
    logger.warn(`Rate limit exceeded: requestId=${requestId} ip=${req.ip} route=${req.originalUrl} user=${userId}`);
    res.status(429).json({
      success: false,
      message,
    });
  },
});

const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later',
});

const loginLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
});

const otpLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: 'Too many OTP requests from this IP, please try again later',
});

const uploadLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many uploads from this IP, please try again later',
});

const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many token refresh attempts, please try again later',
});

module.exports = {
  globalLimiter,
  loginLimiter,
  otpLimiter,
  uploadLimiter,
  refreshLimiter,
};
