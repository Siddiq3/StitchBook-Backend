/**
 * Activity Routes
 * Secure endpoints for activity log management
 */

const express = require('express');
const activityController = require('../controllers/activity.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

// All activity routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);
router.use(requirePermission('payments:read'));

// GET /activity/order/:orderId - Get activity logs for an order
router.get('/order/:orderId', requirePermission('orders:read'), activityController.getActivityByOrder);

// POST /activity/order/:orderId - Add a comment/note
router.post('/order/:orderId', requirePermission('orders:read'), activityController.addActivityNote);

module.exports = router;

