/**
 * Invoice Routes
 * Handles invoice-related API endpoints
 */

const express = require('express');
const router = express.Router();
const InvoiceController = require('../controllers/invoice.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');

// All routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);

/**
 * @swagger
 * /api/invoices:
 *   post:
 *     summary: Create a new invoice
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shop_id
 *               - total_amount
 *             properties:
 *               shop_id:
 *                 type: integer
 *               order_id:
 *                 type: integer
 *               customer_id:
 *                 type: integer
 *               staff_id:
 *                 type: integer
 *               invoice_date:
 *                 type: string
 *                 format: date
 *               due_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [pending, partial, paid, overdue, cancelled]
 *               subtotal:
 *                 type: number
 *               tax_amount:
 *                 type: number
 *               discount_amount:
 *                 type: number
 *               total_amount:
 *                 type: number
 *               amount_paid:
 *                 type: number
 *               amount_due:
 *                 type: number
 *               payment_method:
 *                 type: string
 *               notes:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', InvoiceController.createInvoice);

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: Get all invoices for a shop
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shop_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: customer_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invoices retrieved successfully
 */
router.get('/', InvoiceController.getInvoicesByShop);

/**
 * @swagger
 * /api/invoices/stats:
 *   get:
 *     summary: Get invoice statistics
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shop_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Invoice statistics retrieved successfully
 */
router.get('/stats', InvoiceController.getInvoiceStats);

/**
 * @swagger
 * /api/invoices/number/{invoiceNumber}:
 *   get:
 *     summary: Get invoice by number
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceNumber
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice retrieved successfully
 *       404:
 *         description: Invoice not found
 */
router.get('/number/:invoiceNumber', InvoiceController.getInvoiceByNumber);

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invoice retrieved successfully
 *       404:
 *         description: Invoice not found
 */
router.get('/:id', InvoiceController.getInvoiceById);

/**
 * @swagger
 * /api/invoices/{id}:
 *   put:
 *     summary: Update invoice
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               invoice_date:
 *                 type: string
 *                 format: date
 *               due_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *               subtotal:
 *                 type: number
 *               tax_amount:
 *                 type: number
 *               discount_amount:
 *                 type: number
 *               total_amount:
 *                 type: number
 *               amount_paid:
 *                 type: number
 *               amount_due:
 *                 type: number
 *               payment_method:
 *                 type: string
 *               notes:
 *                 type: string
 *               items:
 *                 type: array
 *     responses:
 *       200:
 *         description: Invoice updated successfully
 *       404:
 *         description: Invoice not found
 */
router.put('/:id', InvoiceController.updateInvoice);

/**
 * @swagger
 * /api/invoices/{id}/payment:
 *   put:
 *     summary: Record payment for invoice
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *               payment_method:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment recorded successfully
 *       404:
 *         description: Invoice not found
 */
router.put('/:id/payment', InvoiceController.recordPayment);

/**
 * @swagger
 * /api/invoices/{id}:
 *   delete:
 *     summary: Delete invoice
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invoice deleted successfully
 *       404:
 *         description: Invoice not found
 */
router.delete('/:id', InvoiceController.deleteInvoice);

module.exports = router;
