/**
 * Dashboard Cache Layer
 * Short TTL plus explicit invalidation after data mutations.
 */

const CacheService = require('./cache.service');

const ttlFromEnv = Number(process.env.DASHBOARD_CACHE_TTL_SECONDS || 60);
const DASHBOARD_CACHE_TTL = Math.max(15, Math.min(300, Number.isFinite(ttlFromEnv) ? ttlFromEnv : 60));

exports.getDashboardStatsWithCache = async (shopId, period, orderType, producer) => {
  const cacheKey = `dashboard:${shopId}:${period}:${orderType || 'all'}`;
  return CacheService.wrap(cacheKey, DASHBOARD_CACHE_TTL, producer);
};

exports.invalidateDashboardCache = async (shopId) => {
  if (shopId === undefined || shopId === null) return;
  await CacheService.invalidatePrefix(`dashboard:${shopId}:`);
};

exports.getUserProfileWithCache = async (userId, producer) => {
  const cacheKey = `user:profile:${userId}`;
  return CacheService.wrap(cacheKey, 10 * 60, producer);
};

exports.invalidateUserCache = async (userId) => {
  await CacheService.del(`user:profile:${userId}`);
};

exports.DASHBOARD_CACHE_TTL = DASHBOARD_CACHE_TTL;
