/**
 * Authentication Routes
 * Production-ready routes for Google and mobile authentication
 */

const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');
const { loginLimiter, otpLimiter, refreshLimiter } = require('../middleware/rateLimit/limitersRedis');

const router = express.Router();

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * POST /api/auth/google
 * Google Login
 * Body: { idToken: "GOOGLE_ID_TOKEN" }
 */
router.post('/google', loginLimiter, authController.googleLogin);

/**
 * POST /api/auth/msg91-widget
 * MSG91 widget verified mobile login
 * Body: { accessToken: "MSG91_WIDGET_ACCESS_TOKEN" }
 */
router.post('/msg91-widget', otpLimiter, loginLimiter, authController.msg91WidgetLogin);

/**
 * POST /api/auth/msg91-mobile/send-otp
 * Backend-backed MSG91 mobile OTP send.
 * Body: { identifier: "919876543210" }
 */
router.post('/msg91-mobile/send-otp', otpLimiter, authController.msg91MobileSendOtp);

/**
 * POST /api/auth/msg91-mobile/verify-otp
 * Backend-backed MSG91 mobile OTP verify and login.
 * Body: { reqId: "...", otp: "1234" }
 */
router.post('/msg91-mobile/verify-otp', otpLimiter, loginLimiter, authController.msg91MobileVerifyOtp);

/**
 * POST /api/auth/login
 * Legacy Firebase OTP Login
 * Body: { firebaseToken: "ID_TOKEN" }
 */
router.post('/login', otpLimiter, loginLimiter, authController.login);

/**
 * POST /api/auth/verify-token
 * Verify if JWT token is still valid
 * Body: { token: "JWT_TOKEN" }
 */
router.post('/verify-token', authController.verifyToken);

/**
 * POST /api/auth/refresh-token
 * Get new access token using refresh token
 * Body: { refreshToken: "REFRESH_TOKEN" }
 */
router.post('/refresh-token', refreshLimiter, authController.refreshToken);

// ============================================================================
// PROTECTED ROUTES (Require JWT token)
// ============================================================================

/**
 * GET /api/auth/profile
 * Get current user profile
 * Header: Authorization: Bearer JWT_TOKEN
 */
router.get('/profile', authMiddleware, authController.getProfile);

/**
 * PUT /api/auth/profile
 * Update current user profile
 * Header: Authorization: Bearer JWT_TOKEN
 * Body: { name?: "New Name" }
 */
router.put('/profile', authMiddleware, authController.updateProfile);

/**
 * GET /api/auth/methods
 * List linked login methods for the current user.
 */
router.get('/methods', authMiddleware, authController.getAuthMethods);

/**
 * POST /api/auth/link/google
 * Link a verified Google identity to the current account.
 * Body: { idToken: "GOOGLE_ID_TOKEN" }
 */
router.post('/link/google', authMiddleware, loginLimiter, authController.linkGoogle);

/**
 * POST /api/auth/link/mobile/verify-otp
 * Link a verified mobile number to the current account.
 * Use public /msg91-mobile/send-otp first, then submit { reqId, otp } here.
 */
router.post('/link/mobile/verify-otp', authMiddleware, otpLimiter, authController.linkMobileVerifyOtp);

/**
 * POST /api/auth/logout
 * Logout user
 * Header: Authorization: Bearer JWT_TOKEN
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * POST /api/auth/logout-all
 * Logout all trusted devices
 */
router.post('/logout-all', authMiddleware, authController.logoutAll);

/**
 * GET /api/auth/sessions
 * List trusted devices
 */
router.get('/sessions', authMiddleware, authController.getSessions);

/**
 * DELETE /api/auth/session/:id
 * Logout selected trusted device
 */
router.delete('/session/:id', authMiddleware, authController.deleteSession);

module.exports = router;
