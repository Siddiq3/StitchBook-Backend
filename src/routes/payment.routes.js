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
router.get('/checkout-session/:checkoutToken', paymentController.getRazorpayCheckoutSession);
router.post('/razorpay/verify-payment', paymentController.verifyRazorpayOrderPayment);

// Protected payment routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);

// POST /payment/razorpay/create-order - Create secure Razorpay checkout session for an order
router.post('/razorpay/create-order', requirePermission('payments:write'), paymentController.createRazorpayOrderPayment);

// POST /payment - Record a new payment
router.post('/', requirePermission('payments:write'), paymentController.createPayment);

// GET /payment/order/:orderId - Get all payments for an order
router.get('/order/:orderId', requirePermission('payments:read'), paymentController.getPaymentsByOrder);

// DELETE /payment/:id - Delete a payment
router.delete('/:id', requirePermission('payments:write'), paymentController.deletePayment);

module.exports = router;
