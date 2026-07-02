/**
 * Authentication Controller
 * Handles HTTP requests for authentication
 * Production-ready with proper validation and error handling
 */

const AuthService = require('../services/auth.service');
const Msg91WidgetService = require('../services/msg91Widget.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

const getAuthMeta = (req) => ({
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  device: typeof req.body.device === 'object'
    ? JSON.stringify(req.body.device)
    : req.body.device || req.get('User-Agent') || null,
  platform: req.body.platform || null,
});

/**
 * POST /api/auth/google
 * Google Sign-In login.
 */
exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return responder.error(res, 400, 'Google ID token is required');
    }

    const result = await AuthService.loginWithGoogleToken(idToken, getAuthMeta(req));

    logger.info(`✓ Google user login successful. User: ${result.user.id}`);
    responder.success(res, 200, 'Google login successful', result);
  } catch (error) {
    logger.warn('Google login error:', error.message);
    responder.error(res, 401, 'Google login failed', error.message);
  }
};

/**
 * POST /api/auth/msg91-widget
 * Mobile login after MSG91 widget verifies OTP on the client.
 */
exports.msg91WidgetLogin = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return responder.error(res, 400, 'MSG91 widget access token is required');
    }

    const result = await AuthService.loginWithMsg91Widget(accessToken, getAuthMeta(req));

    logger.info(`✓ Mobile OTP login successful. User: ${result.user.id}`);
    responder.success(res, 200, 'Mobile login successful', result);
  } catch (error) {
    logger.warn('MSG91 widget login error:', error.message);
    responder.error(res, 401, 'Mobile OTP login failed', error.message);
  }
};

exports.msg91MobileSendOtp = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return responder.error(res, 400, 'Mobile number is required');
    }

    const result = await Msg91WidgetService.sendMobileOtp(identifier);
    responder.success(res, 200, 'OTP sent successfully', {
      reqId: result.reqId,
    });
  } catch (error) {
    logger.warn('MSG91 mobile send OTP error:', error.message);
    responder.error(res, 400, 'Unable to send OTP', error.message);
  }
};

exports.msg91MobileVerifyOtp = async (req, res) => {
  try {
    const { reqId, otp } = req.body;

    if (!reqId || !otp) {
      return responder.error(res, 400, 'OTP request id and OTP are required');
    }

    const result = await AuthService.loginWithMsg91Otp(reqId, otp, getAuthMeta(req));

    logger.info(`✓ Mobile OTP login successful. User: ${result.user.id}`);
    responder.success(res, 200, 'Mobile login successful', result);
  } catch (error) {
    logger.warn('MSG91 mobile verify OTP error:', error.message);
    responder.error(res, 401, 'Mobile OTP login failed', error.message);
  }
};

exports.getAuthMethods = async (req, res) => {
  try {
    const methods = await AuthService.getAuthMethods(req.user.id);
    responder.success(res, 200, 'Auth methods retrieved', methods);
  } catch (error) {
    logger.warn('Get auth methods error:', error.message);
    responder.error(res, 400, 'Unable to get auth methods', error.message);
  }
};

exports.linkGoogle = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return responder.error(res, 400, 'Google ID token is required');
    }

    const result = await AuthService.linkGoogleToUser(req.user.id, idToken);
    responder.success(res, 200, 'Google account linked', result);
  } catch (error) {
    logger.warn('Link Google error:', error.message);
    const status = error.code === 'IDENTITY_ALREADY_LINKED' || error.code === 'EMAIL_ALREADY_USED' ? 409 : 400;
    responder.error(res, status, 'Unable to link Google account', error.message);
  }
};

exports.linkMobileVerifyOtp = async (req, res) => {
  try {
    const { reqId, otp } = req.body;

    if (!reqId || !otp) {
      return responder.error(res, 400, 'OTP request id and OTP are required');
    }

    const result = await AuthService.linkMobileToUser(req.user.id, reqId, otp);
    responder.success(res, 200, 'Mobile number linked', result);
  } catch (error) {
    logger.warn('Link mobile error:', error.message);
    const status = error.code === 'PHONE_ALREADY_LINKED' ? 409 : 400;
    responder.error(res, status, 'Unable to link mobile number', error.message);
  }
};

exports.linkMobileAccessToken = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return responder.error(res, 400, 'MSG91 widget access token is required');
    }

    const result = await AuthService.linkMobileAccessTokenToUser(req.user.id, accessToken);
    responder.success(res, 200, 'Mobile number linked', result);
  } catch (error) {
    logger.warn('Link mobile token error:', error.message);
    const status = error.code === 'PHONE_ALREADY_LINKED' ? 409 : 400;
    responder.error(res, status, 'Unable to link mobile number', error.message);
  }
};

/**
 * POST /api/auth/login
 * Firebase OTP Login Endpoint
 *
 * Frontend flow:
 * 1. User enters phone number
 * 2. Firebase sends OTP to phone
 * 3. User enters OTP
 * 4. Firebase returns ID Token
 * 5. Frontend sends ID Token to this endpoint
 *
 * Request body:
 * {
 *   "firebaseToken": "eyJhbGciOiJIUzI1NiIs..."
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "token": "JWT_TOKEN",
 *   "refreshToken": "REFRESH_TOKEN",
 *   "user": { id, phone, name, shopId },
 *   "expiresIn": 2592000
 * }
 */
exports.login = async (req, res) => {
  try {
    const { firebaseToken } = req.body;

    // Validate request
    if (!firebaseToken) {
      logger.warn('Login attempt without Firebase token');
      return responder.error(res, 400, 'Firebase token is required');
    }

    // Authenticate user
    const result = await AuthService.loginWithFirebaseToken(firebaseToken, {
      ...getAuthMeta(req),
    });

    logger.info(`✓ User login successful. Phone: ${result.user.phone}`);

    responder.success(res, 200, 'Login successful', result);
  } catch (error) {
    logger.warn('Login error:', error.message);

    // Handle specific Firebase errors
    if (error.message.includes('Redis') || error.message.includes('unavailable')) {
      return responder.error(res, 503, 'Service temporarily unavailable. Please try again later.', error.message);
    }
    if (error.message.includes('Invalid Firebase token')) {
      return responder.error(res, 401, 'Invalid Firebase token', error.message);
    }
    if (error.message.includes('Phone number not found')) {
      return responder.error(res, 400, 'Invalid OTP verification', error.message);
    }

    responder.error(res, 500, 'Login failed', error.message);
  }
};

/**
 * GET /api/auth/profile
 * Get Current User Profile
 * Protected endpoint - requires JWT token
 *
 * Headers:
 * Authorization: Bearer JWT_TOKEN
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const token = req.headers.authorization.slice(7);

    const user = await AuthService.getUserProfile(token);

    responder.success(res, 200, 'Profile retrieved', user);
  } catch (error) {
    logger.error('Get profile error:', error.message);
    responder.error(res, 401, 'Failed to get profile', error.message);
  }
};

/**
 * PUT /api/auth/profile
 * Update User Profile
 * Protected endpoint - requires JWT token
 *
 * Request body:
 * {
 *   "name": "John Doe"
 * }
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name } = req.body;

    const user = await AuthService.updateUserProfile(userId, { name });

    logger.info(`✓ User profile updated: ${userId}`);

    responder.success(res, 200, 'Profile updated', user);
  } catch (error) {
    logger.error('Update profile error:', error.message);
    responder.error(res, 500, 'Failed to update profile', error.message);
  }
};

/**
 * POST /api/auth/verify-token
 * Verify JWT Token
 * Public endpoint - checks if a token is still valid
 *
 * Request body:
 * {
 *   "token": "JWT_TOKEN"
 * }
 *
 * Response:
 * {
 *   "valid": true,
 *   "userId": 1,
 *   "phone": "+919876543210"
 * }
 */
exports.verifyToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return responder.error(res, 400, 'Token is required');
    }

    const result = await AuthService.verifyJWTToken(token);

    responder.success(res, 200, 'Token is valid', result);
  } catch (error) {
    logger.warn('Token verification failed:', error.message);
    if (error.message.includes('Redis') || error.message.includes('unavailable')) {
      return responder.error(res, 503, 'Service temporarily unavailable. Please try again later.', error.message);
    }
    responder.error(res, 401, 'Invalid or expired token', error.message);
  }
};

/**
 * POST /api/auth/refresh-token
 * Refresh Access Token
 * Use refresh token to get a new access token
 *
 * Request body:
 * {
 *   "refreshToken": "REFRESH_TOKEN"
 * }
 *
 * Response:
 * {
 *   "token": "NEW_JWT_TOKEN",
 *   "expiresIn": 2592000
 * }
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return responder.error(res, 400, 'Refresh token is required');
    }

    const result = await AuthService.refreshAccessToken(refreshToken);

    logger.info('✓ Access token refreshed');

    responder.success(res, 200, 'Token refreshed', result);
  } catch (error) {
    logger.warn('Token refresh failed:', error.message);
    if (error.message.includes('Redis') || error.message.includes('unavailable')) {
      return responder.error(res, 503, 'Service temporarily unavailable. Please try again later.', error.message);
    }
    responder.error(res, 401, 'Invalid or expired refresh token', error.message);
  }
};

/**
 * POST /api/auth/logout
 * Logout User
 * Protected endpoint - requires JWT token
 *
 * Headers:
 * Authorization: Bearer JWT_TOKEN
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Logged out successfully..."
 * }
 */
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization.slice(7);

    const result = await AuthService.logout(token);

    logger.info(`✓ User logged out: ${req.user.userId}`);

    responder.success(res, 200, 'Logged out successfully', result);
  } catch (error) {
    logger.error('Logout error:', error.message);
    if (error.message.includes('Redis') || error.message.includes('unavailable')) {
      return responder.error(res, 503, 'Service temporarily unavailable. Please try again later.', error.message);
    }
    responder.error(res, 500, 'Logout failed', error.message);
  }
};

exports.logoutAll = async (req, res) => {
  try {
    const result = await AuthService.logoutAll(req.user.userId);
    logger.info(`✓ User logged out all sessions: ${req.user.userId}`);
    responder.success(res, 200, 'All devices logged out', result);
  } catch (error) {
    logger.error('Logout all error:', error.message);
    responder.error(res, 500, 'Failed to logout all devices', error.message);
  }
};

exports.getSessions = async (req, res) => {
  try {
    const sessions = await AuthService.listSessions(req.user.userId, req.user.sessionId);
    responder.success(res, 200, 'Sessions retrieved', sessions);
  } catch (error) {
    logger.error('Get sessions error:', error.message);
    responder.error(res, 500, 'Failed to get sessions', error.message);
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const result = await AuthService.logoutSession(req.user.userId, req.params.id);
    responder.success(res, 200, 'Session logged out', result);
  } catch (error) {
    logger.error('Delete session error:', error.message);
    responder.error(res, 404, 'Session not found', error.message);
  }
};
