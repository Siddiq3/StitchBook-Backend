/**
 * Activity Routes
 * Secure endpoints for activity log management
 */

const express = require('express');
const activityController = require('../controllers/activity.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');

const router = express.Router();

// All activity routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);

// GET /activity/order/:orderId - Get activity logs for an order
router.get('/order/:orderId', activityController.getActivityByOrder);

// POST /activity/order/:orderId - Add a comment/note
router.post('/order/:orderId', activityController.addActivityNote);

module.exports = router;
