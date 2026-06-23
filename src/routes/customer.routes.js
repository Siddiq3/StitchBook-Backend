/**
 * Customer Routes
 * Secure multi-tenant routes - customers filtered by authenticated user's shop
 * 
 * OLD (INSECURE) → NEW (SECURE):
 * POST /customer/add              → POST /customer
 * GET /customer/:customerId       → GET /customer/:id
 * GET /customer/shop/:shopId      → ❌ REMOVED (use GET /customer)
 * GET /customer/search/:shopId    → GET /customer?search=...
 * PUT /customer/:customerId       → PUT /customer/:id
 * DELETE /customer/:customerId    → DELETE /customer/:id
 */

const express = require('express');
const customerController = require('../controllers/customer.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

// All customer routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);

// POST /customer - Create a new customer for user's shop
router.post('/', requirePermission('customers:write'), customerController.createCustomer);

// GET /customer - Get all customers for user's shop (with optional search)
router.get('/', requirePermission('customers:read'), customerController.getCustomers);

// GET /customer/:id - Get specific customer (with ownership check)
router.get('/:id', requirePermission('customers:read'), customerController.getCustomer);

// PUT /customer/:id - Update customer (with ownership check)
router.put('/:id', requirePermission('customers:write'), customerController.updateCustomer);

// DELETE /customer/:id - Delete customer (with ownership check)
router.delete('/:id', requirePermission('customers:write'), customerController.deleteCustomer);

module.exports = router;
