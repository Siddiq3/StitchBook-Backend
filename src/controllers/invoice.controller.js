/**
 * Invoice Controller
 * Handles invoice-related business logic
 */

const InvoiceModel = require('../models/invoice.model');
const { parsePagination } = require('../utils/pagination');
const logger = require('../utils/logger');

class InvoiceController {
  /**
   * Create a new invoice
   * POST /api/invoices
   */
  static async createInvoice(req, res) {
    try {
      const { 
        shop_id, order_id, customer_id, staff_id, invoice_date, due_date,
        status, subtotal, tax_amount, discount_amount, total_amount,
        amount_paid, amount_due, payment_method, notes, items
      } = req.body;

      // Validation
      if (!shop_id || !total_amount) {
        return res.status(400).json({
          success: false,
          message: 'shop_id and total_amount are required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const invoice = await InvoiceModel.createInvoice({
        shop_id,
        order_id,
        customer_id,
        staff_id,
        invoice_date,
        due_date,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        amount_paid,
        amount_due,
        payment_method,
        notes,
        items
      });

      return res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: invoice,
        error: {}
      });
    } catch (error) {
      logger.error('Create invoice error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create invoice',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get invoice by ID
   * GET /api/invoices/:id
   */
  static async getInvoiceById(req, res) {
    try {
      const { id } = req.params;
      const invoice = await InvoiceModel.getInvoiceById(id);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Invoice retrieved successfully',
        data: invoice,
        error: {}
      });
    } catch (error) {
      logger.error('Get invoice error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve invoice',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get invoice by number
   * GET /api/invoices/number/:invoiceNumber
   */
  static async getInvoiceByNumber(req, res) {
    try {
      const { invoiceNumber } = req.params;
      const invoice = await InvoiceModel.getInvoiceByNumber(invoiceNumber);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Invoice retrieved successfully',
        data: invoice,
        error: {}
      });
    } catch (error) {
      logger.error('Get invoice by number error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve invoice',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get all invoices for a shop
   * GET /api/invoices
   */
  static async getInvoicesByShop(req, res) {
    try {
      const { shop_id } = req.query;
      const status = req.query.status || null;
      const customer_id = req.query.customer_id ? parseInt(req.query.customer_id, 10) : null;
      const { limit, offset } = parsePagination(req, 50, 100);

      if (!shop_id) {
        return res.status(400).json({
          success: false,
          message: 'shop_id is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const invoices = await InvoiceModel.getInvoicesByShop(shopId, status, customer_id, limit, offset);
      const total = await InvoiceModel.getInvoiceCount(shopId, status);

      return res.status(200).json({
        success: true,
        message: 'Invoices retrieved successfully',
        data: {
          invoices,
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + invoices.length < total
          }
        },
        error: {}
      });
    } catch (error) {
      logger.error('Get invoices error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve invoices',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get invoice statistics
   * GET /api/invoices/stats
   */
  static async getInvoiceStats(req, res) {
    try {
      const { shop_id } = req.query;
      const start_date = req.query.start_date || null;
      const end_date = req.query.end_date || null;

      if (!shop_id) {
        return res.status(400).json({
          success: false,
          message: 'shop_id is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const stats = await InvoiceModel.getInvoiceStats(shopId, start_date, end_date);

      return res.status(200).json({
        success: true,
        message: 'Invoice statistics retrieved successfully',
        data: stats,
        error: {}
      });
    } catch (error) {
      logger.error('Get invoice stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve invoice statistics',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Update invoice
   * PUT /api/invoices/:id
   */
  static async updateInvoice(req, res) {
    try {
      const { id } = req.params;
      const { 
        invoice_date, due_date, status, subtotal, tax_amount, discount_amount,
        total_amount, amount_paid, amount_due, payment_method, notes, items
      } = req.body;

      const existingInvoice = await InvoiceModel.getInvoiceById(id);
      if (!existingInvoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      const invoice = await InvoiceModel.updateInvoice(id, {
        invoice_date,
        due_date,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        amount_paid,
        amount_due,
        payment_method,
        notes,
        items
      });

      return res.status(200).json({
        success: true,
        message: 'Invoice updated successfully',
        data: invoice,
        error: {}
      });
    } catch (error) {
      logger.error('Update invoice error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update invoice',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Record payment for invoice
   * PUT /api/invoices/:id/payment
   */
  static async recordPayment(req, res) {
    try {
      const { id } = req.params;
      const { amount, payment_method } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid payment amount is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const invoice = await InvoiceModel.recordPayment(id, amount, payment_method);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Payment recorded successfully',
        data: invoice,
        error: {}
      });
    } catch (error) {
      logger.error('Record payment error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to record payment',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Delete invoice
   * DELETE /api/invoices/:id
   */
  static async deleteInvoice(req, res) {
    try {
      const { id } = req.params;

      const deleted = await InvoiceModel.deleteInvoice(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Invoice deleted successfully',
        data: {},
        error: {}
      });
    } catch (error) {
      logger.error('Delete invoice error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete invoice',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }
}

module.exports = InvoiceController;