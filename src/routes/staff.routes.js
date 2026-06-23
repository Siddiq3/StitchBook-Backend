/**
 * Staff Routes
 * Handles staff-related API endpoints
 */

const express = require('express');
const router = express.Router();
const StaffController = require('../controllers/staff.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');
const { requirePermission } = require('../middleware/permissions');

// All routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);

/**
 * @swagger
 * /api/staff:
 *   post:
 *     summary: Create a new staff member
 *     tags: [Staff]
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
 *               - name
 *             properties:
 *               shop_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [tailor, helper, designer, manager, delivery]
 *               salary:
 *                 type: number
 *               commission_rate:
 *                 type: number
 *               aadhar_number:
 *                 type: string
 *               address:
 *                 type: string
 *               photo_url:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               joined_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Staff member created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate entry
 */
router.post('/', requirePermission('staff:write'), StaffController.createStaff);

/**
 * @swagger
 * /api/staff:
 *   get:
 *     summary: Get all staff for a shop
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shop_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: boolean
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
 *         description: Staff list retrieved successfully
 */
router.get('/', requirePermission('staff:read'), StaffController.getStaffByShop);

/**
 * @swagger
 * /api/staff/role/{role}:
 *   get:
 *     summary: Get staff by role
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: shop_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Staff list retrieved successfully
 */
router.get('/role/:role', requirePermission('staff:read'), StaffController.getStaffByRole);

/**
 * @swagger
 * /api/staff/{id}/work:
 *   post:
 *     summary: Record item-level work completed by a staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/work', requirePermission('payroll:write'), StaffController.createWorkLog);

/**
 * @swagger
 * /api/staff/{id}/work:
 *   get:
 *     summary: Get item-level work logs for a staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/work', requirePermission('payroll:read'), StaffController.getWorkLogs);

/**
 * @swagger
 * /api/staff/{id}/work/{workLogId}:
 *   delete:
 *     summary: Delete one staff work entry
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id/work/:workLogId', requirePermission('payroll:write'), StaffController.deleteWorkLog);

/**
 * @swagger
 * /api/staff/{id}/summary:
 *   get:
 *     summary: Get staff earnings and item summary
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/summary', requirePermission('payroll:read'), StaffController.getWorkSummary);

/**
 * @swagger
 * /api/staff/{id}:
 *   get:
 *     summary: Get staff by ID
 *     tags: [Staff]
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
 *         description: Staff member retrieved successfully
 *       404:
 *         description: Staff member not found
 */
router.get('/:id', requirePermission('staff:read'), StaffController.getStaffById);

/**
 * @swagger
 * /api/staff/{id}:
 *   put:
 *     summary: Update staff member
 *     tags: [Staff]
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
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *               salary:
 *                 type: number
 *               commission_rate:
 *                 type: number
 *               aadhar_number:
 *                 type: string
 *               address:
 *                 type: string
 *               photo_url:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               joined_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Staff member updated successfully
 *       404:
 *         description: Staff member not found
 */
router.put('/:id', requirePermission('staff:write'), StaffController.updateStaff);

/**
 * @swagger
 * /api/staff/{id}:
 *   delete:
 *     summary: Delete staff member (soft delete)
 *     tags: [Staff]
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
 *         description: Staff member deleted successfully
 *       404:
 *         description: Staff member not found
 */
router.delete('/:id', requirePermission('staff:write'), StaffController.deleteStaff);

module.exports = router;
