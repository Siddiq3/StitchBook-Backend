/**
 * Payment Service
 * Handles payment-related business logic
 */

const PaymentModel = require('../models/payment.model');
const OrderModel = require('../models/order.model');
const ActivityLogModel = require('../models/activity.model');
const logger = require('../utils/logger');
const cashfree = require('./cashfree');
const db = require('../config/database');
const crypto = require('crypto');
const { transaction } = require('../models/billingLedger');
const { client: redis, isReady: isRedisReady, keyPrefix } = require('../config/redis');
const DashboardCacheService = require('./dashboardCache.service');

const CHECKOUT_TTL_SECONDS = 15 * 60;
const checkoutKey = (token) => `${keyPrefix}payment_checkout:${token}`;

class PaymentService {
  static async createCashfreeCheckoutSession({order,userId,shopId,amount,customer}) {
    if (!isRedisReady()) throw new Error('Payment checkout is temporarily unavailable');
    const payableAmount = amount == null ? Number(order.balance_due) : Number(amount);
    if (!Number.isFinite(payableAmount) || payableAmount < 1) throw new Error('Payment amount must be at least ₹1');
    if (payableAmount > Number(order.balance_due)) throw new Error('Payment amount cannot be more than balance due');
    const details = cashfree.customerDetails(`order_${order.id}`,customer);
    const checkoutToken = crypto.randomBytes(32).toString('hex');
    const cashfreeOrderId = `customer_${crypto.randomUUID()}`;
    const session = {checkoutToken,userId,shopId,orderId:order.id,orderNumber:order.order_number,
      amount:Math.round(payableAmount*100)/100,currency:'INR',cashfreeOrderId,customer:customer||{}};
    // Save ownership before crossing the provider boundary so webhook recovery
    // remains possible if the provider response or Redis write is lost.
    await db.query('INSERT INTO customer_payment_checkouts(provider_order_id,session) VALUES($1,$2)',[cashfreeOrderId,session]);
    const baseUrl = require('./subscription.service').getUpgradePageBaseUrl();
    const providerOrder = await cashfree.createOrder({order_id:cashfreeOrderId,order_amount:session.amount,
      order_currency:'INR', customer_details:details,
      order_meta:{return_url:`${baseUrl}/checkout?checkoutToken=${checkoutToken}&order_id={order_id}`}},crypto.randomUUID());
    if (providerOrder.order_id !== cashfreeOrderId || providerOrder.order_currency !== 'INR' || Math.round(Number(providerOrder.order_amount)*100) !== Math.round(session.amount*100)) throw new Error('Checkout amount mismatch');
    session.paymentSessionId = providerOrder.payment_session_id;
    await redis.set(checkoutKey(checkoutToken),JSON.stringify(session),'EX',CHECKOUT_TTL_SECONDS);
    return {...session,mode:cashfree.getMode(),expiresInSeconds:CHECKOUT_TTL_SECONDS,checkoutUrl:`/checkout?checkoutToken=${checkoutToken}`};
  }

  static async getCashfreeCheckoutSession(checkoutToken) {
    if (!checkoutToken) throw new Error('Checkout token is required');
    if (!isRedisReady()) throw new Error('Payment checkout is temporarily unavailable');
    const raw = await redis.get(checkoutKey(checkoutToken));
    if (!raw) throw new Error('Checkout session expired or invalid');
    const session = JSON.parse(raw);
    return {orderId:session.orderId,orderNumber:session.orderNumber,amount:session.amount,currency:session.currency,
      cashfreeOrderId:session.cashfreeOrderId,paymentSessionId:session.paymentSessionId,mode:cashfree.getMode(),customer:session.customer};
  }

  static async recordCashfreeSession(session, paymentId) {
    const captured = await cashfree.verifiedPayment(session.cashfreeOrderId,session.amount);
    if (paymentId && String(captured.cf_payment_id) !== String(paymentId)) throw new Error('Payment reference mismatch');
    const cashfreePaymentId = String(captured.cf_payment_id);
    // Webhook and the return page can both record the same payment; notify once
    const alreadyRecorded = await db.queryRow('SELECT 1 FROM payments WHERE provider_payment_id = $1', [`cashfree:${cashfreePaymentId}`]);
    const payment = await this.createPayment(session.orderId,session.shopId,session.amount,'cashfree',
      new Date().toISOString().slice(0,10),session.userId,
      `Cashfree payment ID: ${cashfreePaymentId} | Cashfree order ID: ${session.cashfreeOrderId}`,`cashfree:${cashfreePaymentId}`);
    if (!alreadyRecorded) {
      await require('./notify.service').owner(session.shopId, {
        title: 'Payment received',
        message: `₹${Number(session.amount).toLocaleString('en-IN')} received online for order #${session.orderId}`,
        type: 'payment_received',
        data: { orderId: Number(session.orderId) },
      });
    }
    return {payment,orderId:session.orderId,amount:session.amount,cashfreePaymentId};
  }

  static async verifyAndRecordCashfreePayment({checkoutToken,cashfreeOrderId}) {
    if (!checkoutToken || !cashfreeOrderId) throw new Error('All payment details are required');
    if (!isRedisReady()) throw new Error('Payment checkout is temporarily unavailable');
    const raw = await redis.get(checkoutKey(checkoutToken));
    if (!raw) throw new Error('Checkout session expired or invalid');
    const session = JSON.parse(raw);
    if (session.cashfreeOrderId !== cashfreeOrderId) throw new Error('Payment verification failed');
    return this.recordCashfreeSession(session);
  }

  static async recordFromWebhook({orderId,paymentId}) {
    const row = await db.queryRow('SELECT session FROM customer_payment_checkouts WHERE provider_order_id=$1',[orderId]);
    if (!row) return {ignored:true,reason:'Unknown customer checkout'};
    return this.recordCashfreeSession(row.session,paymentId);
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
      await DashboardCacheService.invalidateDashboardCache(shopId);
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
  static async getPaymentsByOrder(orderId, limit = 20, offset = 0) {
    try {
      const payments = await PaymentModel.getPaymentsByOrder(orderId, limit, offset);
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
        await DashboardCacheService.invalidateDashboardCache(order.shop_id);

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
