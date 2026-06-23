/**
 * Token Blacklist Service
 * Redis-backed blacklist for JWT JTIs so revoked tokens cannot be reused.
 */

const { client: redis, isReady: isRedisReady, keyPrefix } = require('../config/redis');
const logger = require('../utils/logger');

const ACCESS_BLACKLIST_PREFIX = `${keyPrefix}auth:blacklist:access:`;
const REFRESH_BLACKLIST_PREFIX = `${keyPrefix}auth:blacklist:refresh:`;

const getAccessKey = (jti) => `${ACCESS_BLACKLIST_PREFIX}${jti}`;
const getRefreshKey = (jti) => `${REFRESH_BLACKLIST_PREFIX}${jti}`;

const ensureRedis = () => {
  if (!isRedisReady()) {
    throw new Error('Redis is unavailable');
  }
};

exports.blacklistAccessToken = async (jti, ttlSeconds) => {
  if (!jti) return;
  ensureRedis();
  const key = getAccessKey(jti);
  await redis.set(key, 'revoked', 'EX', ttlSeconds || 900);
};

exports.blacklistRefreshToken = async (jti, ttlSeconds) => {
  if (!jti) return;
  ensureRedis();
  const key = getRefreshKey(jti);
  await redis.set(key, 'revoked', 'EX', ttlSeconds || 60 * 60 * 24 * 30);
};

exports.isAccessTokenBlacklisted = async (jti) => {
  if (!jti) {
    return false;
  }
  ensureRedis();
  const key = getAccessKey(jti);
  return Boolean(await redis.exists(key));
};

exports.isRefreshTokenBlacklisted = async (jti) => {
  if (!jti) {
    return false;
  }
  ensureRedis();
  const key = getRefreshKey(jti);
  return Boolean(await redis.exists(key));
};
