/**
 * Activity Log Model
 * Handles all activity log database operations
 */

const db = require('../config/database');

class ActivityLogModel {
  /**
   * Create activity log entry
   * @param {object} activityData - Activity data
   * @returns {object} - Created activity log entry
   */
  static async createActivityLog(activityData) {
    const { order_id, shop_id, user_id, action_type, old_value, new_value, notes } = activityData;
    
    const query = `
      INSERT INTO activity_log (order_id, shop_id, user_id, action_type, old_value, new_value, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, order_id, shop_id, user_id, action_type, old_value, new_value, notes, created_at;
    `;
    
    return db.queryRow(query, [order_id, shop_id, user_id || null, action_type, old_value || null, new_value || null, notes || null]);
  }

  /**
   * Get activity logs for an order
   * @param {number} orderId - Order ID
   * @returns {array} - Array of activity logs
   */
  static async getActivityLogByOrder(orderId) {
    const query = `
      SELECT id, order_id, shop_id, user_id, action_type, old_value, new_value, notes, created_at
      FROM activity_log
      WHERE order_id = $1
      ORDER BY created_at DESC;
    `;
    
    return db.queryAll(query, [orderId]);
  }

  /**
   * Get activity log by ID
   * @param {number} logId - Activity log ID
   * @returns {object} - Activity log entry
   */
  static async getActivityLogById(logId) {
    const query = `
      SELECT id, order_id, shop_id, user_id, action_type, old_value, new_value, notes, created_at
      FROM activity_log
      WHERE id = $1;
    `;
    
    return db.queryRow(query, [logId]);
  }
}

module.exports = ActivityLogModel;
