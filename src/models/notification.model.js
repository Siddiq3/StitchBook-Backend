/**
 * Notification Model
 * Handles all notification-related database operations
 */

const db = require('../config/database');

class NotificationModel {
  /**
   * Create a new notification
   * @param {object} notificationData - Notification data
   * @returns {object} - Created notification
   */
  static async createNotification(notificationData) {
    const { shop_id, user_id, title, message, type, data } = notificationData;
    
    const query = `
      INSERT INTO notifications (shop_id, user_id, title, message, type, data, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, shop_id, user_id, title, message, type, is_read, read_at, data, created_at;
    `;
    
    return db.queryRow(query, [shop_id, user_id || null, title, message, type || 'general', data ? JSON.stringify(data) : null]);
  }

  /**
   * Get notification by ID
   * @param {number} notificationId - Notification ID
   * @returns {object} - Notification data
   */
  static async getNotificationById(notificationId) {
    const query = `
      SELECT id, shop_id, user_id, title, message, type, is_read, read_at, data, created_at
      FROM notifications
      WHERE id = $1;
    `;
    
    return db.queryRow(query, [notificationId]);
  }

  /**
   * Get notifications for a shop
   * @param {number} shopId - Shop ID
   * @param {number} limit - Limit (default 50)
   * @param {number} offset - Offset for pagination
   * @returns {array} - Array of notifications
   */
  static async getNotificationsByShop(shopId, limit = 50, offset = 0) {
    const query = `
      SELECT id, shop_id, user_id, title, message, type, is_read, read_at, data, created_at
      FROM notifications
      WHERE shop_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    
    return db.queryAll(query, [shopId, limit, offset]);
  }

  /**
   * Get notifications for a user
   * @param {number} userId - User ID
   * @param {number} limit - Limit (default 50)
   * @param {number} offset - Offset for pagination
   * @returns {array} - Array of notifications
   */
  static async getNotificationsByUser(userId, limit = 50, offset = 0) {
    const query = `
      SELECT id, shop_id, user_id, title, message, type, is_read, read_at, data, created_at
      FROM notifications
      WHERE user_id = $1 OR user_id IS NULL
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    
    return db.queryAll(query, [userId, limit, offset]);
  }

  /**
   * Get unread notification count
   * @param {number} shopId - Shop ID
   * @param {number} userId - User ID (optional)
   * @returns {number} - Unread count
   */
  static async getUnreadCount(shopId, userId = null) {
    let query = `SELECT COUNT(*) as count FROM notifications WHERE shop_id = $1 AND is_read = false`;
    const params = [shopId];
    
    if (userId) {
      query += ` AND (user_id = $2 OR user_id IS NULL)`;
      params.push(userId);
    }
    
    const result = await db.queryRow(query, params);
    return parseInt(result.count, 10);
  }

  /**
   * Mark notification as read
   * @param {number} notificationId - Notification ID
   * @returns {object} - Updated notification
   */
  static async markAsRead(notificationId) {
    const query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE id = $1
      RETURNING id, shop_id, user_id, title, message, type, is_read, read_at, data, created_at;
    `;
    
    return db.queryRow(query, [notificationId]);
  }

  /**
   * Mark all notifications as read for a shop/user
   * @param {number} shopId - Shop ID
   * @param {number} userId - User ID (optional)
   * @returns {number} - Number of updated notifications
   */
  static async markAllAsRead(shopId, userId = null) {
    let query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE shop_id = $1 AND is_read = false
    `;
    const params = [shopId];
    
    if (userId) {
      query += ` AND (user_id = $2 OR user_id IS NULL)`;
      params.push(userId);
    }
    
    query += ` RETURNING id;`;
    
    const result = await db.queryAll(query, params);
    return result.length;
  }

  /**
   * Delete notification
   * @param {number} notificationId - Notification ID
   * @returns {boolean} - Success status
   */
  static async deleteNotification(notificationId) {
    const query = `
      DELETE FROM notifications
      WHERE id = $1
      RETURNING id;
    `;
    
    const result = await db.queryRow(query, [notificationId]);
    return !!result;
  }

  /**
   * Delete old notifications (cleanup)
   * @param {number} shopId - Shop ID
   * @param {number} daysOld - Delete notifications older than this many days
   * @returns {number} - Number of deleted notifications
   */
  static async deleteOldNotifications(shopId, daysOld = 30) {
    const query = `
      DELETE FROM notifications
      WHERE shop_id = $1 AND created_at < NOW() - INTERVAL '${daysOld} days'
      RETURNING id;
    `;
    
    const result = await db.queryAll(query, [shopId]);
    return result.length;
  }

  /**
   * Get notifications by type
   * @param {number} shopId - Shop ID
   * @param {string} type - Notification type
   * @param {number} limit - Limit
   * @returns {array} - Array of notifications
   */
  static async getNotificationsByType(shopId, type, limit = 50) {
    const query = `
      SELECT id, shop_id, user_id, title, message, type, is_read, read_at, data, created_at
      FROM notifications
      WHERE shop_id = $1 AND type = $2
      ORDER BY created_at DESC
      LIMIT $3;
    `;
    
    return db.queryAll(query, [shopId, type, limit]);
  }
}

module.exports = NotificationModel;