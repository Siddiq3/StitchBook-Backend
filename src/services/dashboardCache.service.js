/**
 * Dashboard Cache Layer
 * Caches expensive dashboard queries for faster response times
 */

const CacheService = require('./cache.service');

const DASHBOARD_CACHE_TTL = 5 * 60; // 5 minutes

exports.getDashboardStatsWithCache = async (shopId, period, orderType) => {
  const cacheKey = `dashboard:${shopId}:${period}:${orderType || 'all'}`;
  return CacheService.wrap(cacheKey, DASHBOARD_CACHE_TTL, async () => {
    // This will be called if cache miss
    // The actual query will be done by the controller
    return null;
  });
};

exports.invalidateDashboardCache = async (shopId) => {
  await CacheService.invalidatePrefix(`dashboard:${shopId}`);
};

exports.getUserProfileWithCache = async (userId) => {
  const cacheKey = `user:profile:${userId}`;
  return CacheService.wrap(cacheKey, 10 * 60, async () => {
    // This will be called if cache miss
    return null;
  });
};

exports.invalidateUserCache = async (userId) => {
  await CacheService.del(`user:profile:${userId}`);
};
