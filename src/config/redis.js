/**
 * Redis Configuration
 * Singleton ioredis client with reconnect strategy and production-safe logging.
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');
require('dotenv').config();

const REDIS_URL = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
const redisOptions = {
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  connectTimeout: 5000,
  commandTimeout: 5000,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  reconnectOnError(err) {
    if (err && err.message && err.message.includes('READONLY')) {
      return 1000;
    }
    return false;
  },
};

if (process.env.REDIS_PASSWORD) {
  redisOptions.password = process.env.REDIS_PASSWORD;
}

if (process.env.REDIS_TLS === 'true') {
  redisOptions.tls = {};
}

const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'app:';
const client = new Redis(REDIS_URL, redisOptions);

const isReady = () => client.status === 'ready';
const getStatus = () => client.status;

client.on('connect', () => {
  logger.info('Redis client connecting');
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

client.on('error', (error) => {
  if (!isReady()) {
    logger.warn('Redis error while unavailable:', error.message);
  } else {
    logger.error('Redis error:', error.message);
  }
});

client.on('close', () => {
  logger.warn('Redis connection closed');
});

client.on('reconnecting', (delay) => {
  logger.warn(`Redis reconnecting in ${delay}ms`);
});

client.on('end', () => {
  logger.warn('Redis connection ended');
});

const shutdownRedis = async () => {
  try {
    await client.quit();
    logger.info('Redis client quit gracefully');
  } catch (error) {
    logger.error('Failed to quit Redis gracefully:', error.message);
  }
};

module.exports = {
  client,
  shutdownRedis,
  isReady,
  getStatus,
  keyPrefix: REDIS_KEY_PREFIX,
};
