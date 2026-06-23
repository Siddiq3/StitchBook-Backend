/**
 * Order Service
 * Handles order-related business logic
 */

const OrderModel = require('../models/order.model');
const logger = require('../utils/logger');

// Valid order statuses (matching database enum)
const VALID_STATUSES = ['pending', 'in_progress', 'ready', 'delivered'];

class OrderService {
  /**
   * Create a new order
   * @param {number} customerId - Customer ID
   * @param {number} shopId - Shop ID (from user's shop)
   * @param {object} orderData - Order data {description, price, delivery_date}
   * @returns {object} - Created order
   */
  static async createOrder(customerId, shopId, orderData) {
    try {
      const order = await OrderModel.createOrder({
        customer_id: customerId,
        shop_id: shopId,
        ...orderData,
      });

      logger.info(`Order created for customer: ${customerId}`);
      return order;
    } catch (error) {
      logger.error('Error creating order:', error.message);
      throw error;
    }
  }

  /**
   * Get order by ID
   * @param {number} orderId - Order ID
   * @returns {object} - Order data
   */
  static async getOrder(orderId) {
    try {
      const order = await OrderModel.getOrderById(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      return order;
    } catch (error) {
      logger.error('Error getting order:', error.message);
      throw error;
    }
  }

  /**
   * Get all orders for a shop with optional status filter
   * @param {number} shopId - Shop ID
   * @param {string} status - Optional status filter
   * @param {number} page - Page number (default 1)
   * @param {number} limit - Records per page (default 20)
   * @returns {object} - Orders and pagination info
   */
  static async getOrdersByShop(shopId, status = null, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      const orders = await OrderModel.getOrdersByShop(shopId, status, limit, offset);

      logger.info(`Retrieved orders for shop: ${shopId}`);

      return {
        orders,
        pagination: {
          page,
          limit,
        },
      };
    } catch (error) {
      logger.error('Error getting orders:', error.message);
      throw error;
    }
  }

  /**
   * Get all orders for a customer
   * @param {number} customerId - Customer ID
   * @param {number} page - Page number (default 1)
   * @param {number} limit - Records per page (default 20)
   * @returns {object} - Orders and pagination info
   */
  static async getOrdersByCustomer(customerId, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      const orders = await OrderModel.getOrdersByCustomer(customerId, limit, offset);

      logger.info(`Retrieved orders for customer: ${customerId}`);

      return {
        orders,
        pagination: {
          page,
          limit,
        },
      };
    } catch (error) {
      logger.error('Error getting orders:', error.message);
      throw error;
    }
  }

  /**
   * Update order (status, price, delivery date, etc.)
   * @param {number} orderId - Order ID
   * @param {object} updateData - Data to update
   * @returns {object} - Updated order
   */
  static async updateOrder(orderId, updateData) {
    try {
      // Validate status if provided
      if (updateData.status) {
        if (!VALID_STATUSES.includes(updateData.status)) {
          throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
        }
      }

      const order = await OrderModel.updateOrder(orderId, updateData);
      
      if (!order) {
        throw new Error('Failed to update order');
      }

      logger.info(`Updated order: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('Error updating order:', error.message);
      throw error;
    }
  }

  /**
   * Delete order
   * @param {number} orderId - Order ID
   * @returns {boolean} - Success status
   */
  static async deleteOrder(orderId) {
    try {
      const result = await OrderModel.deleteOrder(orderId);
      
      if (!result) {
        throw new Error('Failed to delete order');
      }

      logger.info(`Deleted order: ${orderId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting order:', error.message);
      throw error;
    }
  }

  /**
   * Get order statistics for a shop
   * @param {number} shopId - Shop ID
   * @returns {object} - Statistics with counts for each status
   */
  static async getOrderStats(shopId) {
    try {
      const pending = await OrderModel.getOrderCountByStatus(shopId, 'pending');
      const inProgress = await OrderModel.getOrderCountByStatus(shopId, 'in_progress');
      const ready = await OrderModel.getOrderCountByStatus(shopId, 'ready');
      const delivered = await OrderModel.getOrderCountByStatus(shopId, 'delivered');

      return {
        pending,
        in_progress: inProgress,
        ready,
        delivered,
        total: pending + inProgress + ready + delivered,
      };
    } catch (error) {
      logger.error('Error getting order stats:', error.message);
      throw error;
    }
  }
}

module.exports = OrderService;
