/**
 * Session Service
 * Redis-backed session storage to support refresh token rotation and revocation.
 */

const { v4: uuidv4 } = require('uuid');
const { client: redis, isReady: isRedisReady, keyPrefix } = require('../config/redis');
const logger = require('../utils/logger');

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // trusted devices live for 90 days
const SESSION_KEY_PREFIX = `${keyPrefix}auth:session:`;
const USER_SESSION_KEY_PREFIX = `${keyPrefix}auth:user-sessions:`;

const getSessionKey = (sessionId) => `${SESSION_KEY_PREFIX}${sessionId}`;
const getUserSessionKey = (userId) => `${USER_SESSION_KEY_PREFIX}${userId}`;

const ensureRedis = () => {
  if (!isRedisReady()) {
    throw new Error('Redis is unavailable');
  }
};

const normalizeSession = (data) => {
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return {
    sessionId: data.sessionId,
    userId: Number(data.userId),
    refreshJti: data.refreshJti,
    active: data.active === 'true',
    createdAt: Number(data.createdAt),
    ip: data.ip,
    userAgent: data.userAgent,
    device: data.device,
    platform: data.platform,
    trustedDevice: data.trustedDevice === 'true',
    lastRefreshAt: data.lastRefreshAt ? Number(data.lastRefreshAt) : null,
  };
};

exports.createSession = async ({ sessionId = uuidv4(), userId, refreshJti, ip, userAgent, device, platform }) => {
  ensureRedis();
  const key = getSessionKey(sessionId);
  const userSessionKey = getUserSessionKey(userId);

  await redis.hmset(key, {
    sessionId,
    userId: String(userId),
    refreshJti: refreshJti || '',
    active: 'true',
    createdAt: String(Date.now()),
    ip: ip || '',
    userAgent: userAgent || '',
    device: device || '',
    platform: platform || '',
    trustedDevice: 'true',
    lastRefreshAt: String(Date.now()),
  });
  await redis.expire(key, SESSION_TTL_SECONDS);
  await redis.sadd(userSessionKey, sessionId);
  await redis.expire(userSessionKey, SESSION_TTL_SECONDS);

  return {
    sessionId,
    userId,
    refreshJti,
    active: true,
    trustedDevice: true,
  };
};

exports.getSession = async (sessionId) => {
  ensureRedis();
  const key = getSessionKey(sessionId);
  const session = await redis.hgetall(key);
  return normalizeSession(session);
};

exports.rotateRefreshToken = async (sessionId, currentRefreshJti, nextRefreshJti) => {
  ensureRedis();
  const key = getSessionKey(sessionId);

  // Use Redis WATCH/MULTI to make refresh token rotation atomic.
  // This prevents two concurrent refresh requests from both succeeding
  // on the same refresh token, which would break replay protection.
  await redis.watch(key);
  const session = await exports.getSession(sessionId);

  if (!session || !session.active) {
    await redis.unwatch();
    throw new Error('Session is not active');
  }

  if (session.refreshJti !== currentRefreshJti) {
    await redis.unwatch();
    await exports.revokeSession(sessionId);
    throw new Error('Refresh token reuse detected');
  }

  const transaction = redis.multi();
  transaction.hmset(key, {
    refreshJti: nextRefreshJti,
    lastRefreshAt: String(Date.now()),
  });
  transaction.expire(key, SESSION_TTL_SECONDS);
  transaction.expire(getUserSessionKey(session.userId), SESSION_TTL_SECONDS);

  const results = await transaction.exec();
  if (results === null) {
    await exports.revokeSession(sessionId);
    throw new Error('Refresh token reuse detected');
  }

  return {
    sessionId,
    userId: session.userId,
    refreshJti: nextRefreshJti,
  };
};

exports.revokeSession = async (sessionId) => {
  ensureRedis();
  const key = getSessionKey(sessionId);
  const session = await exports.getSession(sessionId);
  await redis.del(key);
  if (session?.userId) {
    await redis.srem(getUserSessionKey(session.userId), sessionId);
  }
};

exports.listSessionsForUser = async (userId) => {
  ensureRedis();
  const sessionIds = await redis.smembers(getUserSessionKey(userId));
  const sessions = [];

  for (const sessionId of sessionIds) {
    const session = await exports.getSession(sessionId);
    if (session && session.active) {
      sessions.push(session);
    } else {
      await redis.srem(getUserSessionKey(userId), sessionId);
    }
  }

  return sessions.sort((a, b) => (b.lastRefreshAt || b.createdAt) - (a.lastRefreshAt || a.createdAt));
};

exports.revokeAllSessionsForUser = async (userId) => {
  ensureRedis();
  const sessionIds = await redis.smembers(getUserSessionKey(userId));

  if (sessionIds.length > 0) {
    await redis.del(...sessionIds.map(getSessionKey));
  }

  await redis.del(getUserSessionKey(userId));
  return { revoked: sessionIds.length };
};
