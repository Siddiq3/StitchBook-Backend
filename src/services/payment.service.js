/**
 * Payment Service
 * Handles payment-related business logic
 */

const PaymentModel = require('../models/payment.model');
const OrderModel = require('../models/order.model');
const ActivityLogModel = require('../models/activity.model');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { client: redis, isReady: isRedisReady, keyPrefix } = require('../config/redis');

const CHECKOUT_TTL_SECONDS = 15 * 60;
const checkoutKey = (token) => `${keyPrefix}payment_checkout:${token}`;

class PaymentService {
  static async createRazorpayCheckoutSession({ order, userId, shopId, amount, customer }) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys are not configured');
    }

    if (!isRedisReady()) {
      throw new Error('Payment checkout is temporarily unavailable');
    }

    const payableAmount = Number(amount || order.balance_due || 0);
    const balanceDue = Number(order.balance_due || 0);

    if (!payableAmount || payableAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    if (balanceDue > 0 && payableAmount > balanceDue) {
      throw new Error('Payment amount cannot be more than balance due');
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(payableAmount * 100),
      currency: 'INR',
      receipt: `order_${order.id}_${Date.now()}`.slice(0, 40),
      notes: {
        stitch_order_id: String(order.id),
        stitch_shop_id: String(shopId),
      },
    });

    const checkoutToken = crypto.randomBytes(32).toString('hex');
    const session = {
      checkoutToken,
      userId,
      shopId,
      orderId: order.id,
      orderNumber: order.order_number,
      amount: payableAmount,
      currency: 'INR',
      razorpayOrderId: razorpayOrder.id,
      customer: {
        name: customer?.name || '',
        email: customer?.email || '',
        phone: customer?.phone || '',
      },
      createdAt: new Date().toISOString(),
    };

    await redis.set(checkoutKey(checkoutToken), JSON.stringify(session), 'EX', CHECKOUT_TTL_SECONDS);

    return {
      checkoutToken,
      expiresInSeconds: CHECKOUT_TTL_SECONDS,
      checkoutUrl: `/checkout?checkoutToken=${checkoutToken}`,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: session.orderId,
      orderNumber: session.orderNumber,
      amount: session.amount,
      currency: session.currency,
      razorpayOrderId: session.razorpayOrderId,
      customer: session.customer,
    };
  }

  static async getRazorpayCheckoutSession(checkoutToken) {
    if (!checkoutToken) {
      throw new Error('Checkout token is required');
    }

    if (!isRedisReady()) {
      throw new Error('Payment checkout is temporarily unavailable');
    }

    const raw = await redis.get(checkoutKey(checkoutToken));
    if (!raw) {
      throw new Error('Checkout session expired or invalid');
    }

    const session = JSON.parse(raw);

    return {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: session.orderId,
      orderNumber: session.orderNumber,
      amount: session.amount,
      currency: session.currency,
      razorpayOrderId: session.razorpayOrderId,
      customer: session.customer,
    };
  }

  static async verifyAndRecordRazorpayPayment({ checkoutToken, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!checkoutToken || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new Error('All payment details are required');
    }

    if (!isRedisReady()) {
      throw new Error('Payment checkout is temporarily unavailable');
    }

    const key = checkoutKey(checkoutToken);
    const raw = await redis.get(key);
    if (!raw) {
      throw new Error('Checkout session expired or invalid');
    }

    const session = JSON.parse(raw);
    if (session.razorpayOrderId !== razorpayOrderId) {
      throw new Error('Payment verification failed');
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(razorpaySignature);
    const isValidSignature =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!isValidSignature) {
      throw new Error('Payment verification failed');
    }

    const notes = `Razorpay payment ID: ${razorpayPaymentId} | Razorpay order ID: ${razorpayOrderId}`;
    const payment = await this.createPayment(
      session.orderId,
      session.shopId,
      session.amount,
      'razorpay',
      new Date().toISOString().split('T')[0],
      session.userId,
      notes
    );

    await redis.del(key);

    return {
      payment,
      orderId: session.orderId,
      amount: session.amount,
      razorpayPaymentId,
    };
  }

  /**
   * Create a new payment and update order balance
   * @param {number} orderId - Order ID
   * @param {number} shopId - Shop ID
   * @param {number} amount - Payment amount
   * @param {string} paymentMethod - Payment method
   * @param {string} paymentDate - Payment date
   * @param {number} userId - User ID (who recorded payment)
   * @param {string} notes - Payment notes
   * @returns {object} - Created payment
   */
  static async createPayment(orderId, shopId, amount, paymentMethod, paymentDate, userId, notes) {
    try {
      // Create payment record
      const payment = await PaymentModel.createPayment({
        order_id: orderId,
        shop_id: shopId,
        amount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        recorded_by: userId,
        notes,
      });

      // Get total paid so far
      const totalPaid = await PaymentModel.getTotalPaidForOrder(orderId);

      // Get order to calculate new balance
      const order = await OrderModel.getOrderById(orderId);
      const balanceDue = order.total_amount - totalPaid;

      // Update order with new balance
      await OrderModel.updateOrder(orderId, {
        advance_paid: totalPaid,
        balance_due: balanceDue,
      });

      // Create activity log
      await ActivityLogModel.createActivityLog({
        order_id: orderId,
        shop_id: shopId,
        user_id: userId,
        action_type: 'payment',
        new_value: amount.toString(),
        notes: `Payment recorded: ₹${amount} via ${paymentMethod}`,
      });

      logger.info(`Payment created for order: ${orderId}`);
      return payment;
    } catch (error) {
      logger.error('Error creating payment:', error.message);
      throw error;
    }
  }

  /**
   * Get payment by ID
   * @param {number} paymentId - Payment ID
   * @returns {object} - Payment data
   */
  static async getPaymentById(paymentId) {
    try {
      const payment = await PaymentModel.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }
      return payment;
    } catch (error) {
      logger.error('Error getting payment:', error.message);
      throw error;
    }
  }

  /**
   * Get all payments for an order
   * @param {number} orderId - Order ID
   * @returns {array} - Array of payments
   */
  static async getPaymentsByOrder(orderId) {
    try {
      const payments = await PaymentModel.getPaymentsByOrder(orderId);
      logger.info(`Retrieved payments for order: ${orderId}`);
      return payments;
    } catch (error) {
      logger.error('Error getting payments:', error.message);
      throw error;
    }
  }

  /**
   * Delete a payment and recalculate order balance
   * @param {number} paymentId - Payment ID
   * @returns {boolean} - Success status
   */
  static async deletePayment(paymentId) {
    try {
      // Get payment to find order
      const payment = await PaymentModel.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Delete payment
      const deleted = await PaymentModel.deletePayment(paymentId);

      if (deleted) {
        // Recalculate order balance
        const totalPaid = await PaymentModel.getTotalPaidForOrder(payment.order_id);
        const order = await OrderModel.getOrderById(payment.order_id);
        const balanceDue = order.total_amount - totalPaid;

        await OrderModel.updateOrder(payment.order_id, {
          advance_paid: totalPaid,
          balance_due: balanceDue,
        });

        logger.info(`Payment deleted: ${paymentId}`);
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting payment:', error.message);
      throw error;
    }
  }
}

module.exports = PaymentService;
