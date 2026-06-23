/**
 * Payment Controller
 * Handles payment-related HTTP requests
 * Security: All operations filtered by authenticated user's shop
 */

const PaymentService = require('../services/payment.service');
const OrderModel = require('../models/order.model');
const AuthorizationService = require('../services/authorization.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

/**
 * POST /payment/razorpay/create-order
 * Create a secure short-lived checkout session for order payment
 */
exports.createRazorpayOrderPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId, amount, customer } = req.body;

    if (!orderId) {
      return responder.error(res, 400, 'Order ID is required');
    }

    const shop = await AuthorizationService.getUserShop(userId);
    const order = await AuthorizationService.verifyOrderOwnership(userId, orderId);

    const checkout = await PaymentService.createRazorpayCheckoutSession({
      order,
      userId,
      shopId: shop.id,
      amount,
      customer,
    });

    responder.success(res, 201, 'Checkout session created', checkout);
  } catch (error) {
    logger.error('Create Razorpay order payment error:', error.message);

    if (error.message.includes('Unauthorized')) {
      return responder.error(res, 403, error.message);
    }

    responder.error(res, 400, error.message);
  }
};

/**
 * GET /payment/checkout-session/:checkoutToken
 * Get safe checkout details for web page
 */
exports.getRazorpayCheckoutSession = async (req, res) => {
  try {
    const { checkoutToken } = req.params;
    const checkout = await PaymentService.getRazorpayCheckoutSession(checkoutToken);
    responder.success(res, 200, 'Checkout session retrieved', checkout);
  } catch (error) {
    logger.error('Get Razorpay checkout session error:', error.message);
    responder.error(res, 400, error.message);
  }
};

/**
 * POST /payment/razorpay/verify-payment
 * Verify Razorpay signature and record payment
 */
exports.verifyRazorpayOrderPayment = async (req, res) => {
  try {
    const {
      checkoutToken,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const result = await PaymentService.verifyAndRecordRazorpayPayment({
      checkoutToken,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    responder.success(res, 200, 'Payment verified and recorded', result);
  } catch (error) {
    logger.error('Verify Razorpay order payment error:', error.message);

    if (error.message === 'Payment verification failed') {
      return responder.error(res, 400, 'Payment verification failed', { code: 'INVALID_SIGNATURE' });
    }

    responder.error(res, 400, error.message);
  }
};

/**
 * POST /payment
 * Record a payment for an order
 */
exports.createPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId, amount, paymentMethod, paymentDate, notes } = req.body;

    // Validate required fields
    if (!orderId || !amount) {
      return responder.error(res, 400, 'Order ID and amount are required');
    }

    // Get user's shop
    const shop = await AuthorizationService.getUserShop(userId);

    // Verify order ownership
    const order = await AuthorizationService.verifyOrderOwnership(userId, orderId);
    if (!order) {
      return responder.error(res, 403, 'Unauthorized: Order does not belong to your shop');
    }

    // Create payment
    const payment = await PaymentService.createPayment(
      orderId,
      shop.id,
      amount,
      paymentMethod || 'cash',
      paymentDate,
      userId,
      notes
    );

    logger.info(`Payment created for order: ${orderId} by user: ${userId}`);
    responder.success(res, 201, 'Payment recorded', payment);
  } catch (error) {
    logger.error('Create payment error:', error.message);
    responder.error(res, 500, error.message);
  }
};

/**
 * GET /payment/order/:orderId
 * Get all payments for an order
 */
exports.getPaymentsByOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    // Verify order ownership
    const order = await AuthorizationService.verifyOrderOwnership(userId, orderId);
    if (!order) {
      return responder.error(res, 403, 'Unauthorized: Order does not belong to your shop');
    }

    // Get payments
    const payments = await PaymentService.getPaymentsByOrder(orderId);

    responder.success(res, 200, 'Payments retrieved', { items: payments });
  } catch (error) {
    logger.error('Get payments error:', error.message);
    responder.error(res, 500, 'Failed to get payments', error.message);
  }
};

/**
 * DELETE /payment/:id
 * Delete a payment and recalculate order balance
 */
exports.deletePayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: paymentId } = req.params;

    // Get payment
    const payment = await PaymentService.getPaymentById(paymentId);
    if (!payment) {
      return responder.error(res, 404, 'Payment not found');
    }

    // Verify order ownership
    const order = await AuthorizationService.verifyOrderOwnership(userId, payment.order_id);
    if (!order) {
      return responder.error(res, 403, 'Unauthorized: Order does not belong to your shop');
    }

    // Delete payment
    await PaymentService.deletePayment(paymentId);

    logger.info(`Payment deleted: ${paymentId} by user: ${userId}`);
    responder.success(res, 200, 'Payment deleted');
  } catch (error) {
    logger.error('Delete payment error:', error.message);
    responder.error(res, 500, error.message);
  }
};
