/**
 * Invoice Controller
 * Handles invoice-related business logic
 */

const InvoiceModel = require('../models/invoice.model');
const AuthorizationService = require('../services/authorization.service');
const { parsePagination } = require('../utils/pagination');
const logger = require('../utils/logger');

const getWebAppUrl = () =>
  (process.env.WEB_APP_URL || process.env.FRONTEND_URL || 'https://stitch-book-web.vercel.app').replace(/\/$/, '');

const formatDisplayDate = (value, fallback = 'To be confirmed') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  }
  return String(value).split('T')[0];
};

const formatItemsList = (items) => {
  const orderItems = Array.isArray(items) ? items : [];
  if (!orderItems.length) return 'Tailoring order';

  return orderItems.map((item, index) => {
    const name = item.typeLabel || item.type || item.item_name || item.name || 'Item';
    const quantity = Number(item.quantity || 1);
    const price = Number(item.price || item.amount || 0);
    return `${index + 1}. ${name} x ${quantity} - Rs ${price * quantity}`;
  }).join('\n');
};

const buildInvoiceMessage = ({ order, customer, shop }) => {
  const total = Number(order.total_amount || 0);
  const paid = Number(order.advance_paid || 0);
  const balance = Math.max(0, total - paid);
  const orderNo = order.order_number || `#${order.id}`;
  const delivery = formatDisplayDate(order.delivery_date);

  return `Hi ${customer?.name || 'Customer'},

Invoice for order ${orderNo}

${formatItemsList(order.items)}

Delivery: ${delivery}
Total: Rs ${total}
Paid: Rs ${paid}
Balance: Rs ${balance}

${balance > 0 ? 'Please clear the balance at delivery/pickup.' : 'Payment completed. Thank you.'}

- ${shop?.name || 'StitchBook'}`;
};

const buildWhatsAppUrl = (phone, message) => {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const encodedMessage = encodeURIComponent(message || '');

  if (!fullPhone) return `https://wa.me/?text=${encodedMessage}`;
  return `https://wa.me/${fullPhone}?text=${encodedMessage}`;
};

const withShareFields = (invoice, order, customer, shop) => {
  const shareUrl = `${getWebAppUrl()}/invoice/order/${order.id}`;
  const message = buildInvoiceMessage({ order, customer, shop });

  return {
    ...invoice,
    order_id: invoice?.order_id || order.id,
    shop_id: invoice?.shop_id || order.shop_id,
    customer_id: invoice?.customer_id || order.customer_id,
    total_amount: invoice?.total_amount ?? order.total_amount,
    amount_paid: invoice?.amount_paid ?? order.advance_paid ?? 0,
    amount_due: invoice?.amount_due ?? Math.max(0, Number(order.total_amount || 0) - Number(order.advance_paid || 0)),
    items: invoice?.items || order.items || [],
    shareUrl,
    share_url: shareUrl,
    whatsappUrl: buildWhatsAppUrl(customer?.phone, message),
    whatsapp_url: buildWhatsAppUrl(customer?.phone, message),
    message,
  };
};

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
   * Get invoice/share data by order ID
   * GET /api/invoice/order/:orderId
   */
  static async getInvoiceByOrder(req, res) {
    try {
      const userId = req.user.id;
      const { orderId } = req.params;
      const order = await AuthorizationService.verifyOrderOwnership(userId, orderId);
      const shop = await AuthorizationService.getUserShop(userId);
      const customer = order.customer_id
        ? await AuthorizationService.verifyCustomerOwnership(userId, order.customer_id)
        : null;
      const invoice = await InvoiceModel.getInvoiceByOrderId(orderId);

      return res.status(200).json({
        success: true,
        message: 'Invoice share data retrieved successfully',
        data: withShareFields(invoice || {}, order, customer, shop),
        error: {}
      });
    } catch (error) {
      logger.error('Get invoice by order error:', error);
      const statusCode = error.message.includes('Unauthorized') ? 403 : error.message.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        message: statusCode === 500 ? 'Failed to retrieve invoice share data' : error.message,
        error: { code: statusCode === 500 ? 'SERVER_ERROR' : 'NOT_FOUND', details: {} }
      });
    }
  }

  /**
   * Get WhatsApp invoice URL by order ID
   * POST /api/invoice/order/:orderId/whatsapp
   */
  static async getOrderInvoiceWhatsApp(req, res) {
    try {
      const userId = req.user.id;
      const { orderId } = req.params;
      const order = await AuthorizationService.verifyOrderOwnership(userId, orderId);
      const shop = await AuthorizationService.getUserShop(userId);
      const customer = order.customer_id
        ? await AuthorizationService.verifyCustomerOwnership(userId, order.customer_id)
        : null;
      const invoice = await InvoiceModel.getInvoiceByOrderId(orderId);

      return res.status(200).json({
        success: true,
        message: 'WhatsApp invoice link created',
        data: withShareFields(invoice || {}, order, customer, shop),
        error: {}
      });
    } catch (error) {
      logger.error('Invoice WhatsApp link error:', error);
      const statusCode = error.message.includes('Unauthorized') ? 403 : error.message.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        message: statusCode === 500 ? 'Failed to create WhatsApp invoice link' : error.message,
        error: { code: statusCode === 500 ? 'SERVER_ERROR' : 'NOT_FOUND', details: {} }
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

      const invoices = await InvoiceModel.getInvoicesByShop(shop_id, status, customer_id, limit, offset);
      const total = await InvoiceModel.getInvoiceCount(shop_id, status);

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

      const stats = await InvoiceModel.getInvoiceStats(shop_id, start_date, end_date);

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
