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
const { transaction } = require('../models/billingLedger');
const DashboardCacheService = require('../services/dashboardCache.service');
const Notify = require('../services/notify.service');

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

const getItemName = (item = {}, index = 0) =>
  item.typeLabel || item.type || item.item_name || item.name || `Item ${index + 1}`;

const getAssignedName = (item = {}, role) =>
  role === 'cutter'
    ? item.cutter_name || item.cutterName || item.assigned_cutter_name || null
    : item.stitcher_name || item.stitcherName || item.assigned_stitcher_name || null;

const getAssignedId = (item = {}, role) =>
  role === 'cutter'
    ? item.cutter_staff_id || item.cutterStaffId || item.assigned_cutter_id || null
    : item.stitcher_staff_id || item.stitcherStaffId || item.assigned_stitcher_id || null;

const includesStaffAssignment = (items = []) =>
  Array.isArray(items) && items.some((item) =>
    Boolean(
      getAssignedId(item, 'cutter') ||
      getAssignedId(item, 'stitcher') ||
      getAssignedName(item, 'cutter') ||
      getAssignedName(item, 'stitcher')
    )
  );

const rejectStaffAssignmentWithoutPlan = (req, res, items) => {
  if (!includesStaffAssignment(items) || req.subscription?.features?.hasStaffManagement) {
    return false;
  }

  responder.error(res, 402, 'Staff assignments are available on Team and Pro plans.', {
    code: 'STAFF_PLAN_REQUIRED',
    planType: req.subscription?.planType || 'basic',
    recommendedPlan: 'team',
  });
  return true;
};

const createStaffAssignmentLogs = async ({ orderId, shopId, userId, previousItems = [], nextItems = [] }) => {
  const roles = [
    { key: 'cutter', label: 'Cutter' },
    { key: 'stitcher', label: 'Stitcher' },
  ];

  for (const [index, nextItem] of nextItems.entries()) {
    const previousItem = previousItems[index] || {};
    const itemName = getItemName(nextItem, index);

    for (const role of roles) {
      const previousId = getAssignedId(previousItem, role.key);
      const nextId = getAssignedId(nextItem, role.key);
      const previousName = getAssignedName(previousItem, role.key);
      const nextName = getAssignedName(nextItem, role.key);

      if (!nextId || String(previousId || '') === String(nextId || '')) continue;

      const action = previousId ? 'changed' : 'assigned';
      const fromText = previousName ? ` from ${previousName}` : '';
      const notes = `${role.label} ${action}${fromText} to ${nextName || 'staff'} for ${itemName}`;

      await ActivityLogModel.createActivityLog({
        order_id: orderId,
        shop_id: shopId,
        user_id: userId,
        action_type: 'staff_assignment',
        old_value: previousName || previousId || null,
        new_value: nextName || nextId,
        notes,
      });
      await Notify.staff(shopId, nextId, {
        title: 'New work assigned',
        message: `${role.key === 'cutter' ? 'Cutting' : 'Stitching'}: ${itemName}`,
        type: 'work_assigned',
        data: { orderId: Number(orderId) },
      });
    }
  }
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
      // Fabric is optional: customers often bring their own cloth
      if (!item.type || item.quantity === undefined || item.price === undefined) {
        return responder.error(res, 400, 'Each item must have type, quantity, and price');
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

    if (rejectStaffAssignmentWithoutPlan(req, res, items)) return;

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

    // Staff assigned at creation get the same activity entry and notification as later assignments
    if (includesStaffAssignment(items)) {
      await createStaffAssignmentLogs({ orderId: order.id, shopId: shop.id, userId, previousItems: [], nextItems: items })
        .catch((logError) => logger.warn('Assignment log failed:', logError.message));
    }

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

    if (Array.isArray(updateData.items) && rejectStaffAssignmentWithoutPlan(req, res, updateData.items)) return;

    // Verify ownership
    const existingOrder = await AuthorizationService.verifyOrderOwnership(userId, orderId);

    const order = await OrderService.updateOrder(orderId, updateData);

    if (Array.isArray(updateData.items)) {
      await createStaffAssignmentLogs({
        orderId,
        shopId: existingOrder.shop_id,
        userId,
        previousItems: Array.isArray(existingOrder.items) ? existingOrder.items : [],
        nextItems: updateData.items,
      });
    }

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


/**
 * PUT /order/:id/items/:index/done   body: { task: 'cutter' | 'stitcher' }
 * The staff member assigned to that task (or the owner) marks it finished.
 * Locks the order row so concurrent updates to other items are not lost.
 */
exports.markItemDone = async (req, res) => {
  try {
    const { id } = req.params;
    const index = Number.parseInt(req.params.index, 10);
    const task = req.body?.task === 'cutter' ? 'cutter' : req.body?.task === 'stitcher' ? 'stitcher' : null;
    if (!task || !Number.isInteger(index) || index < 0) {
      return responder.error(res, 400, 'A valid item and task (cutter or stitcher) are required');
    }
    const shopId = req.user.shopId;
    const isOwner = req.user.actorType === 'owner';

    const result = await transaction(async (client) => {
      const order = (await client.query(
        'SELECT id, shop_id, items FROM orders WHERE id = $1 AND shop_id = $2 FOR UPDATE',
        [id, shopId]
      )).rows[0];
      if (!order) return { status: 404, message: 'Order not found' };

      const items = Array.isArray(order.items) ? order.items : [];
      const item = items[index];
      if (!item) return { status: 404, message: 'Item not found' };

      const assignedId = getAssignedId(item, task);
      if (!isOwner && String(assignedId || '') !== String(req.user.staffId || '')) {
        return { status: 403, message: 'This item is not assigned to you' };
      }

      const doneKey = task === 'cutter' ? 'cutting_done_at' : 'stitching_done_at';
      if (item[doneKey]) return { status: 200, order, item, already: true };

      items[index] = {
        ...item,
        [doneKey]: new Date().toISOString(),
        production_status: task === 'cutter' ? 'cut_done' : 'stitched',
      };
      const updated = (await client.query(
        'UPDATE orders SET items = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING id, items',
        [JSON.stringify(items), id]
      )).rows[0];
      return { status: 200, order: updated, item: items[index] };
    });

    if (result.status !== 200) return responder.error(res, result.status, result.message);

    if (!result.already) {
      const who = getAssignedName(result.item, task) || (isOwner ? 'Owner' : 'Staff');
      await ActivityLogModel.createActivityLog({
        order_id: Number(id),
        shop_id: shopId,
        user_id: req.user.id,
        action_type: 'work_done',
        old_value: null,
        new_value: task,
        notes: `${who} finished ${task === 'cutter' ? 'cutting' : 'stitching'} for ${getItemName(result.item, index)}`,
      }).catch((error) => logger.warn('Work-done activity log failed:', error.message));
      await DashboardCacheService.invalidateDashboardCache(shopId).catch(() => {});
      if (!isOwner) {
        await Notify.owner(shopId, {
          title: 'Work finished',
          message: `${who} finished ${task === 'cutter' ? 'cutting' : 'stitching'} for ${getItemName(result.item, index)}`,
          type: 'work_done',
          data: { orderId: Number(id) },
        });
      }
    }

    return responder.success(res, 200, 'Work marked as done', { orderId: Number(id), index, item: result.item });
  } catch (error) {
    logger.error('Mark item done error:', error.message);
    return responder.error(res, 500, 'Failed to update work status');
  }
};
