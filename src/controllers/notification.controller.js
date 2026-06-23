/**
 * Notification Controller
 * Handles notification-related business logic
 */

const NotificationModel = require('../models/notification.model');
const { parsePagination } = require('../utils/pagination');
const logger = require('../utils/logger');

class NotificationController {
  /**
   * Create a new notification
   * POST /api/notifications
   */
  static async createNotification(req, res) {
    try {
      const { shop_id, user_id, title, message, type, data } = req.body;

      // Validation
      if (!shop_id || !title || !message) {
        return res.status(400).json({
          success: false,
          message: 'shop_id, title, and message are required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const notification = await NotificationModel.createNotification({
        shop_id,
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
      const notification = await NotificationModel.getNotificationById(id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND', details: {} }
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
      const { shop_id } = req.query;
      const { limit, offset } = parsePagination(req, 50, 100);

      if (!shop_id) {
        return res.status(400).json({
          success: false,
          message: 'shop_id is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const notifications = await NotificationModel.getNotificationsByShop(shopId, limit, offset);
      const unreadCount = await NotificationModel.getUnreadCount(shop_id);

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

      const notification = await NotificationModel.markAsRead(id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification,
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
      const { shop_id } = req.body;
      const userId = req.user.id;

      if (!shop_id) {
        return res.status(400).json({
          success: false,
          message: 'shop_id is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const updatedCount = await NotificationModel.markAllAsRead(shop_id, userId);

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
      const { shop_id } = req.query;
      const userId = req.user.id;

      if (!shop_id) {
        return res.status(400).json({
          success: false,
          message: 'shop_id is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const count = await NotificationModel.getUnreadCount(shop_id, userId);

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