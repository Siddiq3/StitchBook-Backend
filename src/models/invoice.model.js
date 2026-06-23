/**
 * Invoice Model
 * Handles all invoice-related database operations
 */

const db = require('../config/database');

class InvoiceModel {
  /**
   * Generate invoice number
   * @param {number} shopId - Shop ID
   * @returns {string} - Generated invoice number
   */
  static async generateInvoiceNumber(shopId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${shopId}-${year}${month}-${random}`;
  }

  /**
   * Create a new invoice
   * @param {object} invoiceData - Invoice data
   * @returns {object} - Created invoice
   */
  static async createInvoice(invoiceData) {
    const { 
      shop_id, order_id, customer_id, staff_id, invoice_date, due_date,
      status, subtotal, tax_amount, discount_amount, total_amount,
      amount_paid, amount_due, payment_method, notes, items
    } = invoiceData;
    
    // Generate invoice number
    const invoice_number = await this.generateInvoiceNumber(shop_id);
    
    const query = `
      INSERT INTO invoices (
        shop_id, invoice_number, order_id, customer_id, staff_id,
        invoice_date, due_date, status, subtotal, tax_amount, discount_amount,
        total_amount, amount_paid, amount_due, payment_method, notes, items,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
      RETURNING id, shop_id, invoice_number, order_id, customer_id, staff_id,
                invoice_date, due_date, status, subtotal, tax_amount, discount_amount,
                total_amount, amount_paid, amount_due, payment_method, notes, items,
                created_at, updated_at;
    `;
    
    return db.queryRow(query, [
      shop_id, invoice_number, order_id || null, customer_id || null, staff_id || null,
      invoice_date || new Date(), due_date || null, status || 'pending',
      subtotal || 0, tax_amount || 0, discount_amount || 0,
      total_amount, amount_paid || 0, amount_due || total_amount,
      payment_method || null, notes || null, items ? JSON.stringify(items) : null
    ]);
  }

  /**
   * Get invoice by ID
   * @param {number} invoiceId - Invoice ID
   * @returns {object} - Invoice data
   */
  static async getInvoiceById(invoiceId) {
    const query = `
      SELECT id, shop_id, invoice_number, order_id, customer_id, staff_id,
             invoice_date, due_date, status, subtotal, tax_amount, discount_amount,
             total_amount, amount_paid, amount_due, payment_method, notes, items,
             created_at, updated_at
      FROM invoices
      WHERE id = $1;
    `;
    
    return db.queryRow(query, [invoiceId]);
  }

  /**
   * Get invoice by invoice number
   * @param {string} invoiceNumber - Invoice number
   * @returns {object} - Invoice data
   */
  static async getInvoiceByNumber(invoiceNumber) {
    const query = `
      SELECT id, shop_id, invoice_number, order_id, customer_id, staff_id,
             invoice_date, due_date, status, subtotal, tax_amount, discount_amount,
             total_amount, amount_paid, amount_due, payment_method, notes, items,
             created_at, updated_at
      FROM invoices
      WHERE invoice_number = $1;
    `;
    
    return db.queryRow(query, [invoiceNumber]);
  }

  /**
   * Get all invoices for a shop
   * @param {number} shopId - Shop ID
   * @param {string} status - Filter by status
   * @param {number} customerId - Filter by customer
   * @param {number} limit - Limit (default 50)
   * @param {number} offset - Offset for pagination
   * @returns {array} - Array of invoices
   */
  static async getInvoicesByShop(shopId, status = null, customerId = null, limit = 50, offset = 0) {
    let query = `
      SELECT id, shop_id, invoice_number, order_id, customer_id, staff_id,
             invoice_date, due_date, status, subtotal, tax_amount, discount_amount,
             total_amount, amount_paid, amount_due, payment_method, notes, items,
             created_at, updated_at
      FROM invoices
      WHERE shop_id = $1
    `;
    
    const params = [shopId];
    
    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    
    if (customerId) {
      query += ` AND customer_id = $${params.length + 1}`;
      params.push(customerId);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);
    
    return db.queryAll(query, params);
  }

  /**
   * Update invoice
   * @param {number} invoiceId - Invoice ID
   * @param {object} invoiceData - Updated invoice data
   * @returns {object} - Updated invoice
   */
  static async updateInvoice(invoiceId, invoiceData) {
    const { 
      invoice_date, due_date, status, subtotal, tax_amount, discount_amount,
      total_amount, amount_paid, amount_due, payment_method, notes, items
    } = invoiceData;
    
    const query = `
      UPDATE invoices
      SET invoice_date = COALESCE($1, invoice_date),
          due_date = COALESCE($2, due_date),
          status = COALESCE($3, status),
          subtotal = COALESCE($4, subtotal),
          tax_amount = COALESCE($5, tax_amount),
          discount_amount = COALESCE($6, discount_amount),
          total_amount = COALESCE($7, total_amount),
          amount_paid = COALESCE($8, amount_paid),
          amount_due = COALESCE($9, amount_due),
          payment_method = COALESCE($10, payment_method),
          notes = COALESCE($11, notes),
          items = COALESCE($12, items),
          updated_at = NOW()
      WHERE id = $13
      RETURNING id, shop_id, invoice_number, order_id, customer_id, staff_id,
                invoice_date, due_date, status, subtotal, tax_amount, discount_amount,
                total_amount, amount_paid, amount_due, payment_method, notes, items,
                created_at, updated_at;
    `;
    
    return db.queryRow(query, [
      invoice_date, due_date, status, subtotal, tax_amount, discount_amount,
      total_amount, amount_paid, amount_due, payment_method, notes,
      items ? JSON.stringify(items) : null, invoiceId
    ]);
  }

  /**
   * Delete invoice
   * @param {number} invoiceId - Invoice ID
   * @returns {boolean} - Success status
   */
  static async deleteInvoice(invoiceId) {
    const query = `
      DELETE FROM invoices
      WHERE id = $1
      RETURNING id;
    `;
    
    const result = await db.queryRow(query, [invoiceId]);
    return !!result;
  }

  /**
   * Get invoice count for a shop
   * @param {number} shopId - Shop ID
   * @param {string} status - Filter by status
   * @returns {number} - Invoice count
   */
  static async getInvoiceCount(shopId, status = null) {
    let query = `SELECT COUNT(*) as count FROM invoices WHERE shop_id = $1`;
    const params = [shopId];
    
    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }
    
    const result = await db.queryRow(query, params);
    return parseInt(result.count, 10);
  }

  /**
   * Get invoice statistics for a shop
   * @param {number} shopId - Shop ID
   * @param {string} startDate - Start date filter
   * @param {string} endDate - End date filter
   * @returns {object} - Statistics
   */
  static async getInvoiceStats(shopId, startDate = null, endDate = null) {
    let query = `
      SELECT 
        COUNT(*) as total_invoices,
        SUM(total_amount) as total_amount,
        SUM(amount_paid) as total_paid,
        SUM(amount_due) as total_due,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
      FROM invoices
      WHERE shop_id = $1
    `;
    const params = [shopId];
    
    if (startDate) {
      query += ` AND invoice_date >= $${params.length + 1}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND invoice_date <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    return db.queryRow(query, params);
  }

  /**
   * Record payment for invoice
   * @param {number} invoiceId - Invoice ID
   * @param {number} amount - Payment amount
   * @param {string} paymentMethod - Payment method
   * @returns {object} - Updated invoice
   */
  static async recordPayment(invoiceId, amount, paymentMethod) {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) return null;
    
    const newAmountPaid = parseFloat(invoice.amount_paid) + parseFloat(amount);
    const newAmountDue = parseFloat(invoice.total_amount) - newAmountPaid;
    const newStatus = newAmountDue <= 0 ? 'paid' : 'partial';
    
    const query = `
      UPDATE invoices
      SET amount_paid = $1,
          amount_due = $2,
          status = $3,
          payment_method = COALESCE($4, payment_method),
          updated_at = NOW()
      WHERE id = $5
      RETURNING id, shop_id, invoice_number, order_id, customer_id, staff_id,
                invoice_date, due_date, status, subtotal, tax_amount, discount_amount,
                total_amount, amount_paid, amount_due, payment_method, notes, items,
                created_at, updated_at;
    `;
    
    return db.queryRow(query, [newAmountPaid, newAmountDue, newStatus, paymentMethod, invoiceId]);
  }
}

module.exports = InvoiceModel;