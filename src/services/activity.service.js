/**
 * Activity Service
 * Handles activity log business logic
 */

const ActivityLogModel = require('../models/activity.model');
const logger = require('../utils/logger');

class ActivityService {
  /**
   * Create activity log entry
   * @param {number} orderId - Order ID
   * @param {number} shopId - Shop ID
   * @param {number} userId - User ID (optional)
   * @param {string} actionType - Type of action
   * @param {string} oldValue - Old value (optional)
   * @param {string} newValue - New value (optional)
   * @param {string} notes - Activity notes
   * @returns {object} - Created activity log entry
   */
  static async createActivityLog(orderId, shopId, userId, actionType, oldValue, newValue, notes) {
    try {
      const activity = await ActivityLogModel.createActivityLog({
        order_id: orderId,
        shop_id: shopId,
        user_id: userId || null,
        action_type: actionType,
        old_value: oldValue || null,
        new_value: newValue || null,
        notes: notes || null,
      });

      logger.info(`Activity log created for order: ${orderId}`);
      return activity;
    } catch (error) {
      logger.error('Error creating activity log:', error.message);
      throw error;
    }
  }

  /**
   * Get activity logs for an order
   * @param {number} orderId - Order ID
   * @returns {array} - Array of activity logs
   */
  static async getActivityLogByOrder(orderId) {
    try {
      const logs = await ActivityLogModel.getActivityLogByOrder(orderId);
      logger.info(`Retrieved activity logs for order: ${orderId}`);
      return logs;
    } catch (error) {
      logger.error('Error getting activity logs:', error.message);
      throw error;
    }
  }

  /**
   * Get activity log by ID
   * @param {number} logId - Activity log ID
   * @returns {object} - Activity log entry
   */
  static async getActivityLogById(logId) {
    try {
      const log = await ActivityLogModel.getActivityLogById(logId);
      if (!log) {
        throw new Error('Activity log not found');
      }
      return log;
    } catch (error) {
      logger.error('Error getting activity log:', error.message);
      throw error;
    }
  }
}

module.exports = ActivityService;
