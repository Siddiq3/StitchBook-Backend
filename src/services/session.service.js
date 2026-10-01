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
  const session = await exports.getSession(sessionId);
  if (!session) throw new Error('Session is not active');

  // A Lua compare-and-swap is atomic even on a shared Redis connection.
  const result = await redis.eval(`
    if redis.call('HGET', KEYS[1], 'active') ~= 'true' then return 0 end
    if redis.call('HGET', KEYS[1], 'refreshJti') ~= ARGV[1] then
      redis.call('DEL', KEYS[1]); return -1
    end
    redis.call('HSET', KEYS[1], 'refreshJti', ARGV[2], 'lastRefreshAt', ARGV[3])
    redis.call('EXPIRE', KEYS[1], ARGV[4])
    redis.call('EXPIRE', KEYS[2], ARGV[4])
    return 1
  `, 2, key, getUserSessionKey(session.userId), currentRefreshJti, nextRefreshJti, String(Date.now()), SESSION_TTL_SECONDS);
  if (Number(result) === -1) throw new Error('Refresh token reuse detected');
  if (Number(result) !== 1) throw new Error('Session is not active');
  return { sessionId, refreshJti: nextRefreshJti };
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
  if (await redis.scard(getUserSessionKey(userId)) > 100) {
    throw new Error('Too many device sessions to display. Sign out all devices and sign in again.');
  }
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

exports.revokeSessionBatch = async (userId) => {
  ensureRedis();
  const pointer = getUserSessionKey(userId);
  const [, scanned] = await redis.sscan(pointer, '0', 'COUNT', 100);
  const ids = scanned.slice(0,100);
  if(ids.length) {
    const commands=redis.multi();
    commands.del(...ids.map(getSessionKey));
    commands.srem(pointer,...ids);
    const results=await commands.exec();
    if(!results||results.some(([error])=>error)) throw new Error('Session revocation is incomplete. Please retry.');
  }
  const remaining = await redis.scard(pointer);
  if(!remaining) await redis.del(pointer);
  return {revoked:ids.length,remaining};
};
exports.revokeAllSessionsForUser = async (userId) => {
  let revoked=0;
  for(let batch=0;batch<20;batch++) {
    const result=await exports.revokeSessionBatch(userId);
    revoked+=result.revoked;
    if(!result.remaining) return {revoked};
  }
  throw new Error('Session revocation is still in progress. Please retry.');
};
