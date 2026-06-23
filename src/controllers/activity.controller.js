/**
 * Activity Controller
 * Handles activity log HTTP requests
 */

const ActivityService = require('../services/activity.service');
const AuthorizationService = require('../services/authorization.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

/**
 * GET /activity/order/:orderId
 * Get activity logs for an order
 */
exports.getActivityByOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    // Verify order ownership
    const order = await AuthorizationService.verifyOrderOwnership(userId, orderId);
    if (!order) {
      return responder.error(res, 403, 'Unauthorized: Order does not belong to your shop');
    }

    // Get activity logs
    const logs = await ActivityService.getActivityLogByOrder(orderId);

    responder.success(res, 200, 'Activity logs retrieved', { items: logs });
  } catch (error) {
    logger.error('Get activity logs error:', error.message);
    responder.error(res, 500, 'Failed to get activity logs', error.message);
  }
};

/**
 * POST /activity/order/:orderId
 * Add a comment/note to order activity
 */
exports.addActivityNote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const { notes } = req.body;

    if (!notes) {
      return responder.error(res, 400, 'Notes are required');
    }

    // Verify order ownership
    const order = await AuthorizationService.verifyOrderOwnership(userId, orderId);
    if (!order) {
      return responder.error(res, 403, 'Unauthorized: Order does not belong to your shop');
    }

    // Get user's shop
    const shop = await AuthorizationService.getUserShop(userId);

    // Create activity log entry
    const activity = await ActivityService.createActivityLog(
      orderId,
      shop.id,
      userId,
      'comment',
      null,
      null,
      notes
    );

    logger.info(`Activity note added to order: ${orderId} by user: ${userId}`);
    responder.success(res, 201, 'Comment added', activity);
  } catch (error) {
    logger.error('Add activity note error:', error.message);
    responder.error(res, 500, error.message);
  }
};
