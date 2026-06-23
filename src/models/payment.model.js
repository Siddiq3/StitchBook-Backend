/**
 * Payment Model
 * Handles all payment-related database operations
 */

const db = require('../config/database');

class PaymentModel {
  /**
   * Create a new payment
   * @param {object} paymentData - Payment data
   * @returns {object} - Created payment
   */
  static async createPayment(paymentData) {
    const { order_id, shop_id, amount, payment_method, payment_date, recorded_by, notes } = paymentData;
    
    const query = `
      INSERT INTO payments (order_id, shop_id, amount, payment_method, payment_date, recorded_by, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, order_id, shop_id, amount, payment_method, payment_date, recorded_by, notes, created_at;
    `;
    
    return db.queryRow(query, [order_id, shop_id, amount, payment_method || 'cash', payment_date || new Date().toISOString().split('T')[0], recorded_by, notes || null]);
  }

  /**
   * Get payment by ID
   * @param {number} paymentId - Payment ID
   * @returns {object} - Payment data
   */
  static async getPaymentById(paymentId) {
    const query = `
      SELECT id, order_id, shop_id, amount, payment_method, payment_date, recorded_by, notes, created_at
      FROM payments
      WHERE id = $1;
    `;
    
    return db.queryRow(query, [paymentId]);
  }

  /**
   * Get all payments for an order
   * @param {number} orderId - Order ID
   * @returns {array} - Array of payments
   */
  static async getPaymentsByOrder(orderId) {
    const query = `
      SELECT id, order_id, shop_id, amount, payment_method, payment_date, recorded_by, notes, created_at
      FROM payments
      WHERE order_id = $1
      ORDER BY created_at DESC;
    `;
    
    return db.queryAll(query, [orderId]);
  }

  /**
   * Get total paid amount for an order
   * @param {number} orderId - Order ID
   * @returns {number} - Total paid
   */
  static async getTotalPaidForOrder(orderId) {
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM payments
      WHERE order_id = $1;
    `;
    
    const result = await db.queryRow(query, [orderId]);
    return result ? parseFloat(result.total_paid) : 0;
  }

  /**
   * Delete payment
   * @param {number} paymentId - Payment ID
   * @returns {boolean} - Success status
   */
  static async deletePayment(paymentId) {
    const query = `
      DELETE FROM payments
      WHERE id = $1;
    `;
    
    const result = await db.query(query, [paymentId]);
    return result.rowCount > 0;
  }
}

module.exports = PaymentModel;
