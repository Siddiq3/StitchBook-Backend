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

// Retired: these wrote to the legacy subscriptions table by id without an
// ownership check, and the old in-app Razorpay checkout never granted access.
router.put('/:subscriptionId/status', subscriptionController.retiredEndpoint);
router.delete('/:subscriptionId', subscriptionController.retiredEndpoint);
router.post('/razorpay/create-order', subscriptionController.retiredEndpoint);
router.post('/razorpay/verify-payment', subscriptionController.retiredEndpoint);

module.exports = router;
