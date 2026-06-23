/**
 * Measurement Routes
 * Secure multi-tenant routes - measurements validated through customer ownership
 * 
 * Routes:
 * POST /measurement              → Create measurement for a customer
 * GET /measurement/customer/:customerId → Get all measurements for customer
 * GET /measurement/:id           → Get specific measurement (with ownership check)
 * PUT /measurement/:id           → Update measurement (with ownership check)
 * DELETE /measurement/:id        → Delete measurement (with ownership check)
 */

const express = require('express');
const measurementController = require('../controllers/measurement.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

// All measurement routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);

// POST /measurement - Create a new measurement for a customer
router.post('/', requirePermission('measurements:write'), measurementController.createMeasurement);

// GET /measurement/customer/:customerId - Get all measurements for a customer
router.get('/customer/:customerId', requirePermission('measurements:read'), measurementController.getMeasurementsByCustomer);

// GET /measurement/:id - Get specific measurement (with ownership check)
router.get('/:id', requirePermission('measurements:read'), measurementController.getMeasurement);

// PUT /measurement/:id - Update measurement (with ownership check)
router.put('/:id', requirePermission('measurements:write'), measurementController.updateMeasurement);

// DELETE /measurement/:id - Delete measurement (with ownership check)
router.delete('/:id', requirePermission('measurements:write'), measurementController.deleteMeasurement);

module.exports = router;
