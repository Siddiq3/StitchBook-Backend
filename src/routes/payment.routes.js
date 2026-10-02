/**
 * Payment Routes
 * Secure endpoints for payment management
 */

const express = require('express');
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

// Public checkout routes use a short-lived checkout token, not the user's access token
router.get('/checkout-session/:checkoutToken', paymentController.getCashfreeCheckoutSession);
router.post('/cashfree/verify-payment', paymentController.verifyCashfreeOrderPayment);

// Protected payment routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);

// POST /payment/cashfree/create-order - Create secure Cashfree checkout session for an order
router.post('/cashfree/create-order', requirePermission('payments:write'), paymentController.createCashfreeOrderPayment);

// POST /payment - Record a new payment
router.post('/', requirePermission('payments:write'), paymentController.createPayment);

// GET /payment/order/:orderId - Get all payments for an order
router.get('/order/:orderId', requirePermission('payments:read'), paymentController.getPaymentsByOrder);

// DELETE /payment/:id - Delete a payment
router.delete('/:id', requirePermission('payments:write'), paymentController.deletePayment);

module.exports = router;
