/**
 * Distributed Rate Limiter
 * Redis-backed rate limiter for multi-instance deployments
 */

const { RedisStore } = require('rate-limit-redis');
const rateLimit = require('express-rate-limit');
const { client: redis, keyPrefix: redisPrefix, getStatus: getRedisStatus } = require('../../config/redis');
const { Command } = require('ioredis');
const logger = require('../../utils/logger');

const createMemoryLimiter = ({ windowMs, max, message }) => rateLimit({
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

const createRedisLimiter = ({ windowMs, max, message, keyPrefix = `${redisPrefix}rate:` }) => {
  const store = new RedisStore({
    prefix: keyPrefix,
    sendCommand: async (...command) => {
      const redisCommand = new Command(command[0], command.slice(1), {
        replyEncoding: 'utf8',
      });
      return redis.sendCommand(redisCommand);
    },
  });

  // Prevent unhandled Promise rejections from script loading during transient Redis outages.
  if (store.incrementScriptSha && typeof store.incrementScriptSha.catch === 'function') {
    store.incrementScriptSha = store.incrementScriptSha.catch((error) => {
      logger.warn('Redis rate limiter increment script load failed:', error.message);
      return null;
    });
  }

  if (store.getScriptSha && typeof store.getScriptSha.catch === 'function') {
    store.getScriptSha = store.getScriptSha.catch((error) => {
      logger.warn('Redis rate limiter get script load failed:', error.message);
      return null;
    });
  }

  return rateLimit({
    store,
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true,
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
};

const createLimiterWithFallback = (options) => {
  const memoryLimiter = createMemoryLimiter(options);
  let redisLimiter = null;

  try {
    redisLimiter = createRedisLimiter(options);
  } catch (error) {
    logger.warn('Redis rate limiter could not be initialized. Falling back to memory limiter:', error.message);
  }

  return (req, res, next) => {
    if (redisLimiter && getRedisStatus() === 'ready') {
      return redisLimiter(req, res, next);
    }

    return memoryLimiter(req, res, next);
  };
};

const globalLimiter = createLimiterWithFallback({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  keyPrefix: `${redisPrefix}rate:global:`,
});

const loginLimiter = createLimiterWithFallback({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  keyPrefix: `${redisPrefix}rate:login:`,
});

const otpLimiter = createLimiterWithFallback({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: 'Too many OTP requests from this IP, please try again later',
  keyPrefix: `${redisPrefix}rate:otp:`,
});

const uploadLimiter = createLimiterWithFallback({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many uploads from this IP, please try again later',
  keyPrefix: `${redisPrefix}rate:upload:`,
});

const refreshLimiter = createLimiterWithFallback({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many token refresh attempts, please try again later',
  keyPrefix: `${redisPrefix}rate:refresh:`,
});

module.exports = {
  globalLimiter,
  loginLimiter,
  otpLimiter,
  uploadLimiter,
  refreshLimiter,
};
