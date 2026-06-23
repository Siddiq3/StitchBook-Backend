/**
 * Shop Routes
 * Secure multi-tenant routes - each user manages only their own shop
 * 
 * OLD (INSECURE) → NEW (SECURE):
 * POST /shop/create     → POST /shop
 * GET /shop             → GET /shop (same)
 * GET /shop/:shopId     → ❌ REMOVED (users can only access their own shop)
 * PUT /shop/:shopId     → PUT /shop
 * DELETE /shop/:shopId  → DELETE /shop
 */

const express = require('express');
const shopController = require('../controllers/shop.controller');
const authMiddleware = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

// All shop routes require authentication
router.use(authMiddleware);

// POST /shop - Create a new shop for authenticated user
router.post('/', requirePermission('shop:write'), shopController.createShop);

// GET /shop - Get authenticated user's shop
router.get('/', requirePermission('shop:read'), shopController.getShop);

// PUT /shop - Update authenticated user's shop
router.put('/', requirePermission('shop:write'), shopController.updateShop);

// DELETE /shop - Delete authenticated user's shop
router.delete('/', requirePermission('shop:write'), shopController.deleteShop);

module.exports = router;
