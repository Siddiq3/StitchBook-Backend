/**
 * Subscription Routes
 */

const express = require('express');
const subscriptionController = require('../controllers/subscription.controller');
const authMiddleware = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

// Public routes
router.post('/verify', subscriptionController.verifySubscription);
router.get('/upgrade-session/:sessionId', subscriptionController.getUpgradeSession);
router.post('/upgrade-session/:sessionId/checkout', subscriptionController.createUpgradeCheckout);
router.post('/upgrade-session/:sessionId/verify', subscriptionController.verifyUpgradeCheckout);

// Protected routes
router.use(authMiddleware);

router.post('/create', requirePermission('shop:write'), subscriptionController.createSubscription);
router.post('/create-upgrade-session', requirePermission('shop:read'), subscriptionController.createUpgradeSession);
router.get('/status', requirePermission('shop:read'), subscriptionController.getSubscriptionStatus);
router.post('/check-active', requirePermission('shop:read'), subscriptionController.checkActive);
router.put('/:subscriptionId/status', requirePermission('shop:write'), subscriptionController.updateSubscriptionStatus);
router.delete('/:subscriptionId', requirePermission('shop:write'), subscriptionController.cancelSubscription);

// Razorpay payment routes
router.post('/razorpay/create-order', requirePermission('shop:write'), subscriptionController.createRazorpayOrder);
router.post('/razorpay/verify-payment', requirePermission('shop:write'), subscriptionController.verifyRazorpayPayment);

module.exports = router;
