/**
 * Order Controller
 * Handles order-related HTTP requests
 * Security: All operations filtered by authenticated user's shop
 */

const OrderService = require('../services/order.service');
const AuthorizationService = require('../services/authorization.service');
const ActivityLogModel = require('../models/activity.model');
const responder = require('../utils/responder');
const logger = require('../utils/logger');
const { parsePagination } = require('../utils/pagination');

// Valid order status flow: pending → cutting → stitching → ready → delivered
const VALID_STATUSES = ['pending', 'cutting', 'stitching', 'ready', 'delivered'];
const normalizeStatus = (status) => status === 'in_progress' ? 'cutting' : status;
const STATUS_LABELS = {
  pending: 'New Order',
  in_progress: 'Cutting',
  cutting: 'Cutting',
  stitching: 'Stitching',
  ready: 'Ready',
  delivered: 'Delivered',
};

/**
 * POST /order
 * Create a new order for authenticated user's shop
 * Security: Shop ID and customer ownership derived from user
 * 
 * Body:
 * {
 *   "customer_id": number,
 *   "items": [
 *     {
 *       "type": "shirt | pant | kurta | ...", 
 *       "fabric": "Cotton | Silk | ...", 
 *       "quantity": number,
 *       "price": number
 *     }
 *   ],
 *   "delivery_date": "2026-05-01",
 *   "description": "optional",
 *   "measurement_id": number (optional)
 * }
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      customer_id,
      items,
      delivery_date,
      description,
      measurement_id,
      measurement_snapshot,
      order_type,
    } = req.body;

    // Validate request
    if (!customer_id) {
      return responder.error(res, 400, 'Customer ID is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return responder.error(res, 400, 'Items array is required and cannot be empty');
    }

    if (order_type && !['stitching', 'alteration'].includes(order_type)) {
      return responder.error(res, 400, 'Order type must be either stitching or alteration');
    }

    // Validate each item has required fields
    let requiresMeasurement = order_type === 'stitching';
    for (const item of items) {
      if (!item.type || !item.fabric || item.quantity === undefined || item.price === undefined) {
        return responder.error(res, 400, 'Each item must have type, fabric, quantity, and price');
      }
      if (item.quantity <= 0 || item.price < 0) {
        return responder.error(res, 400, 'Quantity must be positive and price must be non-negative');
      }
      if (item.type_category === 'stitching' || item.itemType === 'stitching') {
        requiresMeasurement = true;
      }
    }

    if (requiresMeasurement && !measurement_snapshot) {
      return responder.error(res, 400, 'Measurement snapshot is required for stitching orders', {
        code: 'INVALID_INPUT',
      });
    }

    if (measurement_snapshot && typeof measurement_snapshot !== 'object') {
      return responder.error(res, 400, 'Measurement snapshot must be an object or array of objects');
    }

    // Get user's shop
    const shop = await AuthorizationService.getUserShop(userId);

    // Verify customer belongs to user's shop
    await AuthorizationService.verifyCustomerOwnership(userId, customer_id);

    const order = await OrderService.createOrder(customer_id, shop.id, {
      items,
      delivery_date: delivery_date || null,
      description: description || '',
      measurement_id: measurement_id || null,
      measurement_snapshot: measurement_snapshot || null,
      order_type: order_type || 'stitching',
    });

    logger.info(`Order created for customer: ${customer_id} in shop: ${shop.id} with ${items.length} items`);
    responder.success(res, 201, 'Order created', order);
  } catch (error) {
    logger.error('Create order error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 500, 'Failed to create order', error.message);
    }
  }
};

/**
 * GET /order
 * Get all orders for authenticated user's shop
 * Security: Shop ID derived from user, supports filters via query params
 */
exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, customerId } = req.query;
    const { page, limit } = parsePagination(req, 20, 100);

    // Get user's shop
    const shop = await AuthorizationService.getUserShop(userId);

    let result;
    if (customerId) {
      // Verify customer belongs to user's shop
      await AuthorizationService.verifyCustomerOwnership(userId, customerId);
      result = await OrderService.getOrdersByCustomer(
        customerId,
        page,
        limit
      );
    } else {
      result = await OrderService.getOrdersByShop(
        shop.id,
        status,
        page,
        limit
      );
    }

    responder.success(res, 200, 'Orders retrieved', result);
  } catch (error) {
    logger.error('Get orders error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 500, 'Failed to get orders', error.message);
    }
  }
};

/**
 * GET /order/:id
 * Get order by ID with ownership verification
 * Security: Verifies order belongs to user's shop
 */
exports.getOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: orderId } = req.params;

    // Verify ownership
    const order = await AuthorizationService.verifyOrderOwnership(userId, orderId);
    responder.success(res, 200, 'Order retrieved', order);
  } catch (error) {
    logger.error('Get order error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 404, error.message);
    }
  }
};

/**
 * PUT /order/:id
 * Update order with ownership verification
 * Security: Verifies order belongs to user's shop
 */
exports.updateOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: orderId } = req.params;
    const updateData = req.body;

    if (updateData.order_type && !['stitching', 'alteration'].includes(updateData.order_type)) {
      return responder.error(res, 400, 'Order type must be either stitching or alteration');
    }

    // Verify ownership
    await AuthorizationService.verifyOrderOwnership(userId, orderId);

    const order = await OrderService.updateOrder(orderId, updateData);
    responder.success(res, 200, 'Order updated', order);
  } catch (error) {
    logger.error('Update order error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else if (error.message.includes('Invalid status')) {
      responder.error(res, 400, error.message);
    } else {
      responder.error(res, 500, error.message);
    }
  }
};

/**
 * PUT /order/:id/status
 * Update order status with ownership verification
 * Security: Verifies order belongs to user's shop, validates status flow
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: orderId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!status) {
      return responder.error(res, 400, 'Status is required');
    }

    const normalizedStatus = normalizeStatus(status);
    if (!VALID_STATUSES.includes(normalizedStatus)) {
      return responder.error(res, 400, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    // Verify ownership
    const existingOrder = await AuthorizationService.verifyOrderOwnership(userId, orderId);

    // Validate status flow: pending → cutting → stitching → ready → delivered
    const statusFlow = {
      'pending': ['cutting'],
      'in_progress': ['stitching'],
      'cutting': ['stitching'],
      'stitching': ['ready'],
      'ready': ['delivered'],
      'delivered': []
    };

    const allowedNextStatuses = statusFlow[existingOrder.status] || [];
    if (!allowedNextStatuses.includes(normalizedStatus)) {
      return responder.error(res, 400, `Invalid status transition from '${existingOrder.status}' to '${normalizedStatus}'. Allowed: ${allowedNextStatuses.join(', ') || 'none'}`);
    }

    const order = await OrderService.updateOrder(orderId, { status: normalizedStatus });

    await ActivityLogModel.createActivityLog({
      order_id: orderId,
      shop_id: existingOrder.shop_id,
      user_id: userId,
      action_type: 'status_change',
      old_value: existingOrder.status,
      new_value: normalizedStatus,
      notes: `Status changed from ${STATUS_LABELS[existingOrder.status] || existingOrder.status} to ${STATUS_LABELS[normalizedStatus] || normalizedStatus}`,
    });

    responder.success(res, 200, 'Order status updated', order);
  } catch (error) {
    logger.error('Update order status error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 500, error.message);
    }
  }
};

/**
 * DELETE /order/:id
 * Delete order with ownership verification
 * Security: Verifies order belongs to user's shop
 */
exports.deleteOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: orderId } = req.params;

    // Verify ownership
    await AuthorizationService.verifyOrderOwnership(userId, orderId);

    await OrderService.deleteOrder(orderId);
    responder.success(res, 200, 'Order deleted');
  } catch (error) {
    logger.error('Delete order error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 500, 'Failed to delete order', error.message);
    }
  }
};
