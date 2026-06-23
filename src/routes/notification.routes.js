/**
 * Notification Routes
 * Handles notification-related API endpoints
 */

const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');

// All routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Create a new notification
 *     tags: [Notifications]
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
 *               - title
 *               - message
 *             properties:
 *               shop_id:
 *                 type: integer
 *               user_id:
 *                 type: integer
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [general, order, payment, reminder, alert]
 *               data:
 *                 type: object
 *     responses:
 *       201:
 *         description: Notification created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', NotificationController.createNotification);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get notifications for a shop
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shop_id
 *         required: true
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
 *         description: Notifications retrieved successfully
 */
router.get('/', NotificationController.getNotificationsByShop);

/**
 * @swagger
 * /api/notifications/my:
 *   get:
 *     summary: Get notifications for current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Notifications retrieved successfully
 */
router.get('/my', NotificationController.getMyNotifications);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shop_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 */
router.get('/unread-count', NotificationController.getUnreadCount);

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     summary: Get notification by ID
 *     tags: [Notifications]
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
 *         description: Notification retrieved successfully
 *       404:
 *         description: Notification not found
 */
router.get('/:id', NotificationController.getNotificationById);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags: [Notifications]
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
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.put('/:id/read', NotificationController.markAsRead);

/**
 * @swagger
 * /api/notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
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
 *             properties:
 *               shop_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.put('/read-all', NotificationController.markAllAsRead);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
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
 *         description: Notification deleted successfully
 *       404:
 *         description: Notification not found
 */
router.delete('/:id', NotificationController.deleteNotification);

module.exports = router;
