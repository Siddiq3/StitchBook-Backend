/**
 * Notification Controller
 * Handles notification-related business logic
 */

const NotificationModel = require('../models/notification.model');
const { parsePagination } = require('../utils/pagination');
const logger = require('../utils/logger');

const getAuthenticatedShopId = (req) => {
  const rawShopId = req.user?.shop_id ?? req.user?.shopId;
  if (rawShopId === undefined || rawShopId === null || rawShopId === '') {
    return null;
  }
  const numericShopId = Number(rawShopId);
  return Number.isNaN(numericShopId) ? null : numericShopId;
};

class NotificationController {
  /**
   * Create a new notification
   * POST /api/notifications
   */
  static async createNotification(req, res) {
    try {
      const { shop_id, user_id, title, message, type, data } = req.body;
      const authenticatedShopId = getAuthenticatedShopId(req);

      if (!authenticatedShopId) {
        return res.status(403).json({
          success: false,
          message: 'Authenticated shop context is required',
          error: { code: 'FORBIDDEN', details: {} }
        });
      }

      // Validation
      if (!shop_id || !title || !message) {
        return res.status(400).json({
          success: false,
          message: 'shop_id, title, and message are required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const requestedShopId = Number(shop_id);
      if (Number.isNaN(requestedShopId) || requestedShopId !== authenticatedShopId) {
        return res.status(403).json({
          success: false,
          message: 'You can only create notifications for your own shop',
          error: { code: 'FORBIDDEN', details: {} }
        });
      }

      const notification = await NotificationModel.createNotification({
        shop_id: requestedShopId,
        user_id,
        title,
        message,
        type,
        data
      });

      return res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: notification,
        error: {}
      });
    } catch (error) {
      logger.error('Create notification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create notification',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get notification by ID
   * GET /api/notifications/:id
   */
  static async getNotificationById(req, res) {
    try {
      const { id } = req.params;
      const authenticatedShopId = getAuthenticatedShopId(req);
      const notification = await NotificationModel.getNotificationById(id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      if (!authenticatedShopId || Number(notification.shop_id) !== authenticatedShopId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this notification',
          error: { code: 'FORBIDDEN', details: {} }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification retrieved successfully',
        data: notification,
        error: {}
      });
    } catch (error) {
      logger.error('Get notification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get notifications for a shop
   * GET /api/notifications
   */
  static async getNotificationsByShop(req, res) {
    try {
      const authenticatedShopId = getAuthenticatedShopId(req);
      const requestedShopId = req.query.shop_id !== undefined ? Number(req.query.shop_id) : authenticatedShopId;
      const shopId = requestedShopId;
      const { limit, offset } = parsePagination(req, 50, 100);

      if (!authenticatedShopId) {
        return res.status(403).json({
          success: false,
          message: 'Authenticated shop context is required',
          error: { code: 'FORBIDDEN', details: {} }
        });
      }

      if (req.query.shop_id !== undefined && (Number.isNaN(shopId) || shopId !== authenticatedShopId)) {
        return res.status(403).json({
          success: false,
          message: 'You can only access your own shop notifications',
          error: { code: 'FORBIDDEN', details: {} }
        });
      }

      if (!shopId || Number.isNaN(shopId)) {
        return res.status(400).json({
          success: false,
          message: 'shop_id is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const notifications = await NotificationModel.getNotificationsByShop(shopId, limit, offset);
      const unreadCount = await NotificationModel.getUnreadCount(shopId);

      return res.status(200).json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: {
          notifications,
          unread_count: unreadCount,
          pagination: {
            limit,
            offset
          }
        },
        error: {}
      });
    } catch (error) {
      logger.error('Get notifications error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve notifications',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get notifications for current user
   * GET /api/notifications/my
   */
  static async getMyNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { limit, offset } = parsePagination(req, 50, 100);

      const notifications = await NotificationModel.getNotificationsByUser(userId, limit, offset);
      const unreadCount = await NotificationModel.getUnreadCount(null, userId);

      return res.status(200).json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: {
          notifications,
          unread_count: unreadCount,
          pagination: {
            limit,
            offset
          }
        },
        error: {}
      });
    } catch (error) {
      logger.error('Get my notifications error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve notifications',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Mark notification as read
   * PUT /api/notifications/:id/read
   */
  static async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const authenticatedShopId = getAuthenticatedShopId(req);
      const notification = await NotificationModel.getNotificationById(id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      if (!authenticatedShopId || Number(notification.shop_id) !== authenticatedShopId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this notification',
          error: { code: 'FORBIDDEN', details: {} }
        });
      }

      const updatedNotification = await NotificationModel.markAsRead(id);

      if (!updatedNotification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: updatedNotification,
        error: {}
      });
    } catch (error) {
      logger.error('Mark as read error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Mark all notifications as read
   * PUT /api/notifications/read-all
   */
  static async markAllAsRead(req, res) {
    try {
      const authenticatedShopId = getAuthenticatedShopId(req);
      const { shop_id } = req.body;
      const userId = req.user.id;

      if (!authenticatedShopId) {
        return res.status(403).json({
          success: false,
          message: 'Authenticated shop context is required',
          error: { code: 'FORBIDDEN', details: {} }
        });
      }

      if (!shop_id) {
        return res.status(400).json({
          success: false,
          message: 'shop_id is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const requestedShopId = Number(shop_id);
      if (Number.isNaN(requestedShopId) || requestedShopId !== authenticatedShopId) {
        return res.status(403).json({
          success: false,
          message: 'You can only mark notifications as read for your own shop',
          error: { code: 'FORBIDDEN', details: {} }
        });
      }

      const updatedCount = await NotificationModel.markAllAsRead(requestedShopId, userId);

      return res.status(200).json({
        success: true,
        message: `${updatedCount} notifications marked as read`,
        data: { updated_count: updatedCount },
        error: {}
      });
    } catch (error) {
      logger.error('Mark all as read error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notifications as read',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  static async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const authenticatedShopId = getAuthenticatedShopId(req);
      const notification = await NotificationModel.getNotificationById(id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      if (!authenticatedShopId || Number(notification.shop_id) !== authenticatedShopId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this notification',
          error: { code: 'FORBIDDEN', details: {} }
        });
      }

      const deleted = await NotificationModel.deleteNotification(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
        data: {},
        error: {}
      });
    } catch (error) {
      logger.error('Delete notification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get unread count
   * GET /api/notifications/unread-count
   */
  static async getUnreadCount(req, res) {
    try {
      const authenticatedShopId = getAuthenticatedShopId(req);
      const requestedShopId = req.query.shop_id !== undefined ? Number(req.query.shop_id) : authenticatedShopId;
      const userId = req.user.id;

      if (!authenticatedShopId) {
        return res.status(403).json({
          success: false,
          message: 'Authenticated shop context is required',
          error: { code: 'FORBIDDEN', details: {} }
        });
      }

      if (req.query.shop_id !== undefined && (Number.isNaN(requestedShopId) || requestedShopId !== authenticatedShopId)) {
        return res.status(403).json({
          success: false,
          message: 'You can only access unread counts for your own shop',
          error: { code: 'FORBIDDEN', details: {} }
        });
      }

      if (!requestedShopId || Number.isNaN(requestedShopId)) {
        return res.status(400).json({
          success: false,
          message: 'shop_id is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const count = await NotificationModel.getUnreadCount(requestedShopId, userId);

      return res.status(200).json({
        success: true,
        message: 'Unread count retrieved successfully',
        data: { unread_count: count },
        error: {}
      });
    } catch (error) {
      logger.error('Get unread count error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get unread count',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }
}

module.exports = NotificationController;