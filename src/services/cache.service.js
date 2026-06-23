/**
 * Cache Service
 * Generic Redis cache wrapper for shared computed results.
 */

const { client: redis, isReady: isRedisReady, keyPrefix } = require('../config/redis');
const logger = require('../utils/logger');

const CACHE_PREFIX = `${keyPrefix}cache:`;

const getCacheKey = (key) => `${CACHE_PREFIX}${key}`;

const ensureRedis = () => {
  if (!isRedisReady()) {
    throw new Error('Redis is unavailable');
  }
};

exports.get = async (key) => {
  const cacheKey = getCacheKey(key);

  try {
    if (!isRedisReady()) {
      logger.warn(`Cache miss due to Redis unavailable: ${cacheKey}`);
      return null;
    }

    const value = await redis.get(cacheKey);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      logger.error(`Cache parse failed for key=${cacheKey}:`, error.message);
      return null;
    }
  } catch (error) {
    logger.warn(`Redis cache get failed for key=${cacheKey}:`, error.message);
    return null;
  }
};

exports.set = async (key, value, ttlSeconds = 300) => {
  const cacheKey = getCacheKey(key);
  try {
    if (!isRedisReady()) {
      logger.warn(`Skipping cache set because Redis unavailable: ${cacheKey}`);
      return;
    }

    await redis.set(cacheKey, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    logger.warn(`Redis cache set failed for key=${cacheKey}:`, error.message);
  }
};

exports.del = async (key) => {
  const cacheKey = getCacheKey(key);
  try {
    if (!isRedisReady()) {
      logger.warn(`Skipping cache delete because Redis unavailable: ${cacheKey}`);
      return;
    }

    await redis.del(cacheKey);
  } catch (error) {
    logger.warn(`Redis cache delete failed for key=${cacheKey}:`, error.message);
  }
};

exports.invalidatePrefix = async (prefix) => {
  const pattern = `${CACHE_PREFIX}${prefix}*`;
  let cursor = '0';

  try {
    if (!isRedisReady()) {
      logger.warn(`Skipping cache invalidation because Redis unavailable for pattern=${pattern}`);
      return;
    }

    const pipeline = redis.pipeline();

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = nextCursor;
      if (keys.length > 0) {
        pipeline.del(...keys);
      }
    } while (cursor !== '0');

    await pipeline.exec();
  } catch (error) {
    logger.warn(`Redis cache invalidation failed for pattern=${pattern}:`, error.message);
  }
};

exports.wrap = async (key, ttlSeconds, producer) => {
  const cached = await exports.get(key);
  if (cached !== null) {
    return cached;
  }

  const result = await producer();
  await exports.set(key, result, ttlSeconds);
  return result;
};
