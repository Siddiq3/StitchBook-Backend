/**
 * Authentication Middleware
 * Verifies JWT token with Redis-backed session and blacklist checks
 * Production-ready error handling and logging
 */

const TokenService = require('../services/token.service');
const SessionService = require('../services/session.service');
const TokenBlacklistService = require('../services/tokenBlacklist.service');
const UserModel = require('../models/user.model');
const { mergePermissions } = require('../services/permissions.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

/**
 * Middleware to verify JWT token
 * Attaches decoded user info to req.user
 * 
 * Security checks:
 * - Token signature and expiry
 * - Access token blacklist
 * - Session state and activity
 * 
 * Usage:
 * app.get('/api/protected-route', authMiddleware, controllerFunction)
 *
 * Expects header:
 * Authorization: Bearer JWT_TOKEN
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('Missing authorization header');
      return responder.error(res, 401, 'Missing authorization header');
    }

    if (!authHeader.startsWith('Bearer ')) {
      logger.warn('Invalid authorization header format');
      return responder.error(res, 401, 'Invalid authorization header format');
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    // Verify token signature and expiry
    const decoded = TokenService.verifyAccessToken(token);

    // Check if token is blacklisted
    if (await TokenBlacklistService.isAccessTokenBlacklisted(decoded.jti)) {
      logger.warn(`Access token blacklisted: jti=${decoded.jti} userId=${decoded.userId}`);
      return responder.error(res, 401, 'Token has been revoked. Please login again.');
    }

    // Verify session is active
    if (decoded.sessionId) {
      const session = await SessionService.getSession(decoded.sessionId);
      if (!session || !session.active) {
        logger.warn(`Session not active: sessionId=${decoded.sessionId} userId=${decoded.userId}`);
        return responder.error(res, 401, 'Session is not active. Please login again.');
      }

      if (session.userId !== decoded.userId) {
        logger.error(`Session user mismatch: expected=${session.userId} got=${decoded.userId}`);
        return responder.error(res, 401, 'Invalid token');
      }
    }

    // Verify user still exists (one query for user, shop, staff and deletion state)
    const user = await UserModel.getAuthContext(decoded.userId);
    if (!user) {
      logger.warn(`User not found: userId=${decoded.userId}`);
      return responder.error(res, 401, 'User not found');
    }

    const deletionExempt = req.originalUrl.startsWith('/api/auth/') || req.originalUrl.startsWith('/api/user/delete-account');
    if (user.deletion_started_at && !deletionExempt) {
      return responder.error(res,403,'Account deletion is in progress', {code:'ACCOUNT_DELETING'});
    }
    if (user.owner_deleting && !deletionExempt) return responder.error(res,403,'This shop is unavailable');

    const ownedShop = user.owned_shop_id ? { id: user.owned_shop_id } : null;
    const staffAccount = user.staff_id ? {
      id: user.staff_id,
      shop_id: user.staff_shop_id,
      access_role: user.access_role,
      permissions: user.permissions,
      can_login: user.can_login,
    } : null;

    const isOwner = Boolean(ownedShop);
    const actorRole = isOwner ? 'owner' : staffAccount?.access_role || 'pending_owner';
    const permissions = isOwner
      ? ['*']
      : staffAccount
        ? staffAccount.can_login
          ? mergePermissions(staffAccount.access_role, staffAccount.permissions)
          : []
        : ['shop:read', 'shop:write'];
    // Shop access comes only from owning a shop or an *active* staff record.
    // users.shop_id is not trusted: it is left behind when staff are removed.
    const shopId = ownedShop?.id || staffAccount?.shop_id || null;

    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      user_id: decoded.userId,
      phone: decoded.phone,
      email: decoded.email || user?.email || null,
      shop_id: shopId,
      shopId,
      actorType: isOwner ? 'owner' : staffAccount ? 'staff' : 'user',
      role: actorRole,
      staffId: staffAccount?.id || null,
      permissions,
      sessionId: decoded.sessionId,
    };

    logger.debug(`User authenticated: ${decoded.userId}`);
    next();
  } catch (error) {
    logger.warn('Authentication failed:', error.message);

    // Different error messages for different scenarios
    if (error.message.includes('Redis') || error.message.includes('unavailable')) {
      return responder.error(res, 503, 'Service temporarily unavailable. Please try again later.');
    }

    if (error.message.includes('expired')) {
      return responder.error(res, 401, 'Token has expired. Please login again.');
    }

    if (error.message.includes('Invalid')) {
      return responder.error(res, 401, 'Invalid token');
    }

    if (error.message.includes('revoked')) {
      return responder.error(res, 401, 'Token has been revoked. Please login again.');
    }

    responder.error(res, 401, 'Unauthorized', error.message);
  }
};

module.exports = authMiddleware;
