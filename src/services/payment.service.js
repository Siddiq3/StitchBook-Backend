/**
 * Payment Service
 * Handles payment-related business logic
 */

const PaymentModel = require('../models/payment.model');
const OrderModel = require('../models/order.model');
const ActivityLogModel = require('../models/activity.model');
const logger = require('../utils/logger');
const crypto = require('crypto');
const Cashfree = require('./cashfree.service');
const { transaction } = require('../models/billingLedger');
const { client: redis, isReady: isRedisReady, keyPrefix } = require('../config/redis');

const CHECKOUT_TTL_SECONDS = 15 * 60;
const checkoutKey = (token) => `${keyPrefix}payment_checkout:${token}`;

class PaymentService {
  static async createCashfreeCheckoutSession({ order, userId, shopId, amount, customer }) {
    if (!isRedisReady()) {
      throw new Error('Payment checkout is temporarily unavailable');
    }

    const payableAmount = Number(amount || order.balance_due || 0);
    const balanceDue = Number(order.balance_due || 0);
    const amountPaise = Math.round(payableAmount * 100);

    if (!payableAmount || payableAmount <= 0) throw new Error('Payment amount must be greater than zero');
    if (amountPaise < 100) throw new Error('Payment amount must be at least ₹1');
    if (balanceDue > 0 && payableAmount > balanceDue) throw new Error('Payment amount cannot be more than balance due');

    const checkoutToken = crypto.randomBytes(32).toString('hex');
    const cashfreeOrderId = `sb_pay_${String(order.id).slice(0, 12)}_${Date.now().toString(36)}`.slice(0, 45);
    const webBase = String(process.env.WEB_APP_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');

    const providerOrder = await Cashfree.createOrder({
      orderId: cashfreeOrderId,
      amountPaise,
      customer: {
        id: customer?.id || order.customer_id || `order_${order.id}`,
        name: customer?.name || 'Customer',
        email: customer?.email || '',
        phone: customer?.phone || '',
      },
      note: `StitchBook order ${order.order_number || order.id}`,
      tags: {
        stitch_order_id: String(order.id),
        stitch_shop_id: String(shopId),
        type: 'customer_order_payment',
      },
      returnUrl: webBase ? `${webBase}/payment-success?orderId=${encodeURIComponent(order.id)}` : undefined,
    });

    const session = {
      checkoutToken,
      userId,
      shopId,
      orderId: order.id,
      orderNumber: order.order_number,
      amount: payableAmount,
      currency: 'INR',
      cashfreeOrderId,
      paymentSessionId: providerOrder.payment_session_id,
      cashfreeMode: Cashfree.publicMode(),
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
      orderId: session.orderId,
      orderNumber: session.orderNumber,
      amount: session.amount,
      currency: session.currency,
      cashfreeOrderId,
      paymentSessionId: session.paymentSessionId,
      cashfreeMode: session.cashfreeMode,
      customer: session.customer,
    };
  }

  static async getCashfreeCheckoutSession(checkoutToken) {
    if (!checkoutToken) throw new Error('Checkout token is required');
    if (!isRedisReady()) throw new Error('Payment checkout is temporarily unavailable');

    const raw = await redis.get(checkoutKey(checkoutToken));
    if (!raw) throw new Error('Checkout session expired or invalid');

    const session = JSON.parse(raw);
    return {
      orderId: session.orderId,
      orderNumber: session.orderNumber,
      amount: session.amount,
      currency: session.currency,
      cashfreeOrderId: session.cashfreeOrderId,
      paymentSessionId: session.paymentSessionId,
      cashfreeMode: session.cashfreeMode,
      customer: session.customer,
    };
  }

  static async confirmCashfreeOrderPayment({ checkoutToken, cashfreeOrderId }) {
    if (!checkoutToken || !cashfreeOrderId) throw new Error('Checkout token and Cashfree order ID are required');
    if (!isRedisReady()) throw new Error('Payment checkout is temporarily unavailable');

    const key = checkoutKey(checkoutToken);
    const raw = await redis.get(key);
    if (!raw) throw new Error('Checkout session expired or invalid');

    const session = JSON.parse(raw);
    if (session.cashfreeOrderId !== cashfreeOrderId) throw new Error('Payment verification failed');

    const { paid, order: providerOrder } = await Cashfree.isOrderPaid(cashfreeOrderId);
    const expectedAmount = Number(Number(session.amount).toFixed(2));
    if (
      !paid ||
      providerOrder?.order_currency !== 'INR' ||
      Number(providerOrder?.order_amount) !== expectedAmount
    ) {
      throw new Error('Payment is not completed or amount does not match');
    }

    const providerPaymentId = `cashfree:${cashfreeOrderId}`;
    const notes = `Cashfree order ID: ${cashfreeOrderId}`;
    const payment = await this.createPayment(
      session.orderId,
      session.shopId,
      session.amount,
      'cashfree',
      new Date().toISOString().split('T')[0],
      session.userId,
      notes,
      providerPaymentId
    );

    return {
      payment,
      orderId: session.orderId,
      amount: session.amount,
      cashfreeOrderId,
      providerPaymentId,
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
  static async createPayment(orderId, shopId, amount, paymentMethod, paymentDate, userId, notes, providerPaymentId = null) {
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error('Payment amount must be greater than zero');
    return transaction(async client => {
      const order = (await client.query('SELECT * FROM orders WHERE id=$1 AND shop_id=$2 FOR UPDATE',[orderId,shopId])).rows[0];
      if (!order) throw new Error('Order not found');
      if (providerPaymentId) {
        const previous = (await client.query('SELECT * FROM payments WHERE provider_payment_id=$1',[providerPaymentId])).rows[0];
        if (previous) {
          if (String(previous.order_id)!==String(orderId)) throw new Error('Payment ownership mismatch');
          return previous;
        }
      }
      const payment = (await client.query(`INSERT INTO payments(order_id,shop_id,amount,payment_method,payment_date,recorded_by,notes,provider_payment_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[orderId,shopId,amount,paymentMethod||'cash',paymentDate||new Date().toISOString().slice(0,10),userId,notes||null,providerPaymentId||null])).rows[0];
      const totalPaid=Number((await client.query('SELECT COALESCE(SUM(amount),0) AS total_paid FROM payments WHERE order_id=$1',[orderId])).rows[0].total_paid);
      await client.query('UPDATE orders SET advance_paid=$2,balance_due=total_amount-$2,updated_at=NOW() WHERE id=$1',[orderId,totalPaid]);
      await client.query(`INSERT INTO activity_log(order_id,shop_id,user_id,action_type,new_value,notes) VALUES($1,$2,$3,'payment',$4,$5)`,[orderId,shopId,userId,String(amount),`Payment recorded: ₹${amount} via ${paymentMethod}`]);
      return payment;
    });
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
