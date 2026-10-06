/**
 * Distributed Rate Limiter
 * Redis-backed rate limiter for multi-instance deployments
 */

const { RedisStore } = require('rate-limit-redis');
const rateLimit = require('express-rate-limit');
const { client: redis, keyPrefix: redisPrefix, getStatus: getRedisStatus } = require('../../config/redis');
const { Command } = require('ioredis');
const logger = require('../../utils/logger');
const crypto = require('crypto');

// Keys. Indian mobile carriers put many phones behind one shared IP (CGNAT), and a
// shop's owner and staff share Wi-Fi, so pure per-IP keys lock out innocent users.
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
// Collapse IPv6 to its /64 so one device cannot rotate addresses within its block
const ipKey = (req) => {
  const ip = String(req.ip || '');
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
};
// Per IP + the account being targeted (login, OTP)
const ipAndIdentityKey = (req) => {
  const identity = req.body?.identifier || req.body?.email || req.body?.phone || '';
  return `${ipKey(req)}|${hash(String(identity).trim().toLowerCase())}`;
};
// Per session when authenticated, else per IP
const sessionOrIpKey = (req) => {
  const auth = req.get('authorization');
  return auth ? `s:${hash(auth)}` : `ip:${ipKey(req)}`;
};
// Per refresh token (body or cookie), else per IP
const refreshKey = (req) => {
  const token = req.body?.refreshToken || req.cookies?.stitchbook_refresh || req.get('cookie') || '';
  return token ? `r:${hash(token)}` : `ip:${ipKey(req)}`;
};
// Per user on authenticated routes
const userOrIpKey = (req) => (req.user?.id ? `u:${req.user.id}` : `ip:${ipKey(req)}`);

const createMemoryLimiter = ({ windowMs, max, message, keyPrefix, ...options }) => rateLimit({
  windowMs,
  max,
  message,
  ...options,
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

const createRedisLimiter = ({ windowMs, max, message, keyPrefix = `${redisPrefix}rate:`, ...options }) => {
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
    // Per-limiter choices (key, which requests count) come from options
    ...options,
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

// Global traffic uses process memory so ordinary API reads do not spend Redis
// commands. Security-sensitive endpoints below remain Redis-backed so limits
// are shared across instances.
const globalLimiter = createMemoryLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  keyGenerator: sessionOrIpKey,
  message: 'Too many requests from this IP, please try again later',
});

// Counts only FAILED attempts (password guessing); successful sign-ins never lock users out
const loginLimiter = createLimiterWithFallback({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: ipAndIdentityKey,
  message: 'Too many login attempts, please try again later',
  keyPrefix: `${redisPrefix}rate:login:`,
});

// Account creation counts every attempt, so successes cannot be used to spam sign-ups
const registerLimiter = createLimiterWithFallback({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => ipKey(req),
  message: 'Too many sign-up attempts, please try again later',
  keyPrefix: `${redisPrefix}rate:register:`,
});

const otpLimiter = createLimiterWithFallback({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: ipAndIdentityKey,
  message: 'Too many OTP requests from this IP, please try again later',
  keyPrefix: `${redisPrefix}rate:otp:`,
});

const uploadLimiter = createLimiterWithFallback({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  message: 'Too many uploads from this IP, please try again later',
  keyPrefix: `${redisPrefix}rate:upload:`,
});

const refreshLimiter = createLimiterWithFallback({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: refreshKey,
  message: 'Too many token refresh attempts, please try again later',
  keyPrefix: `${redisPrefix}rate:refresh:`,
});

module.exports = {
  globalLimiter,
  loginLimiter,
  registerLimiter,
  otpLimiter,
  uploadLimiter,
  refreshLimiter,
};
