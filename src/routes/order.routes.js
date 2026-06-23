/**
 * Order Routes
 * Secure multi-tenant routes - orders filtered by authenticated user's shop
 * 
 * OLD (INSECURE) → NEW (SECURE):
 * POST /order/create              → POST /order
 * GET /order/:orderId             → GET /order/:id
 * GET /order/shop/:shopId         → ❌ REMOVED (use GET /order)
 * GET /order/customer/:customerId → GET /order?customerId=...
 * PUT /order/:orderId             → PUT /order/:id
 * DELETE /order/:orderId          → DELETE /order/:id
 * 
 * NEW:
 * PUT /order/:id/status          → Update order status (pending → in_progress → ready → delivered)
 */

const express = require('express');
const orderController = require('../controllers/order.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

// All order routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);

// POST /order - Create a new order for user's shop
router.post('/', requirePermission('orders:write'), orderController.createOrder);

// GET /order - Get all orders for user's shop (with optional filters)
router.get('/', requirePermission('orders:read'), orderController.getOrders);

// GET /order/:id - Get specific order (with ownership check)
router.get('/:id', requirePermission('orders:read'), orderController.getOrder);

// PUT /order/:id - Update order (with ownership check)
router.put('/:id', requirePermission('orders:write'), orderController.updateOrder);

// PUT /order/:id/status - Update order status (with ownership check)
router.put('/:id/status', requirePermission('orders:update_status'), orderController.updateOrderStatus);

// DELETE /order/:id - Delete order (with ownership check)
router.delete('/:id', requirePermission('orders:write'), orderController.deleteOrder);

module.exports = router;
