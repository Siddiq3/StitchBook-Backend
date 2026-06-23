/**
 * Dashboard Routes
 * Analytics and statistics endpoints
 */

const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

// All dashboard routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);

// GET /dashboard/stats - Get dashboard statistics
router.get('/stats', requirePermission('dashboard:read'), dashboardController.getDashboardStats);

module.exports = router;
