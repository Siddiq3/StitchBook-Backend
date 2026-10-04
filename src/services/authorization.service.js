/**
 * Authorization Service
 * Validates that resources belong to the authenticated user's shop
 * Implements multi-tenant security checks
 */

const CustomerModel = require('../models/customer.model');
const OrderModel = require('../models/order.model');
const MeasurementModel = require('../models/measurement.model');
const db = require('../config/database');
const logger = require('../utils/logger');

class AuthorizationService {
  /**
   * Verify that a customer belongs to the user's shop
   * @param {number} userId - Authenticated user ID
   * @param {number} customerId - Customer ID to verify
   * @returns {object} - Customer data if authorized
   * @throws Error if not authorized
   */
  static async verifyCustomerOwnership(userId, customerId) {
    try {
      // Owned shop or active staff shop, in one query (see getUserShop)
      const effectiveShop = await this.getUserShop(userId).catch(() => null);

      if (!effectiveShop) {
        logger.warn(`User ${userId} has no shop access`);
        throw new Error('Shop not found');
      }

      // Get customer and verify it belongs to user's shop
      const customer = await CustomerModel.getCustomerById(customerId);
      if (!customer) {
        logger.warn(`Customer ${customerId} not found`);
        throw new Error('Customer not found');
      }

      if (customer.shop_id !== effectiveShop.id) {
        logger.warn(`Unauthorized access attempt: User ${userId} tried to access customer ${customerId} from shop ${customer.shop_id}`);
        throw new Error('Unauthorized: Customer does not belong to your shop');
      }

      return customer;
    } catch (error) {
      logger.error('Authorization check failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify that an order belongs to the user's shop
   * @param {number} userId - Authenticated user ID
   * @param {number} orderId - Order ID to verify
   * @returns {object} - Order data if authorized
   * @throws Error if not authorized
   */
  static async verifyOrderOwnership(userId, orderId) {
    try {
      // Owned shop or active staff shop, in one query (see getUserShop)
      const effectiveShop = await this.getUserShop(userId).catch(() => null);

      if (!effectiveShop) {
        logger.warn(`User ${userId} has no shop access`);
        throw new Error('Shop not found');
      }

      // Get order and verify it belongs to user's shop
      const order = await OrderModel.getOrderById(orderId);
      if (!order) {
        logger.warn(`Order ${orderId} not found`);
        throw new Error('Order not found');
      }

      if (order.shop_id !== effectiveShop.id) {
        logger.warn(`Unauthorized access attempt: User ${userId} tried to access order ${orderId} from shop ${order.shop_id}`);
        throw new Error('Unauthorized: Order does not belong to your shop');
      }

      return order;
    } catch (error) {
      logger.error('Authorization check failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify that a measurement belongs to customer in the user's shop
   * @param {number} userId - Authenticated user ID
   * @param {number} measurementId - Measurement ID to verify
   * @returns {object} - Measurement data if authorized
   * @throws Error if not authorized
   */
  static async verifyMeasurementOwnership(userId, measurementId) {
    try {
      // Owned shop or active staff shop, in one query (see getUserShop)
      const effectiveShop = await this.getUserShop(userId).catch(() => null);

      if (!effectiveShop) {
        logger.warn(`User ${userId} has no shop access`);
        throw new Error('Shop not found');
      }

      // Get measurement and verify it belongs to a customer in user's shop
      const measurement = await MeasurementModel.getMeasurementById(measurementId);
      if (!measurement) {
        logger.warn(`Measurement ${measurementId} not found`);
        throw new Error('Measurement not found');
      }

      // Verify the customer belongs to user's shop
      const customer = await CustomerModel.getCustomerById(measurement.customer_id);
      if (!customer || customer.shop_id !== effectiveShop.id) {
        logger.warn(`Unauthorized access attempt: User ${userId} tried to access measurement ${measurementId}`);
        throw new Error('Unauthorized: Measurement does not belong to your shop');
      }

      return measurement;
    } catch (error) {
      logger.error('Authorization check failed:', error.message);
      throw error;
    }
  }

  /**
   * Get user's shop
   * @param {number} userId - User ID
   * @returns {object} - Shop data
   * @throws Error if shop not found
   */
  static async getUserShop(userId) {
    try {
      // One query: the shop the user owns, else the shop of their *active*
      // staff record. Deliberately ignores users.shop_id, which survives staff
      // removal and would hand a former employee their old shop.
      const shop = await db.queryRow(`
        SELECT s.* FROM (
          SELECT sh.*, 0 AS priority FROM shops sh WHERE sh.user_id = $1
          UNION ALL
          SELECT sh.*, 1 AS priority FROM staff st JOIN shops sh ON sh.id = st.shop_id
          WHERE st.user_id = $1 AND st.is_active = true
        ) s
        ORDER BY s.priority
        LIMIT 1;
      `, [userId]);
      if (shop) {
        delete shop.priority;
        return shop;
      }

      throw new Error('Shop not found. Please create a shop first.');
    } catch (error) {
      logger.error('Error fetching user shop:', error.message);
      throw error;
    }
  }

  /**
   * Verify that a customer belongs to specific shop
   * @param {number} shopId - Shop ID
   * @param {number} customerId - Customer ID
   * @returns {boolean} - True if customer belongs to shop
   */
  static async isCustomerInShop(shopId, customerId) {
    try {
      const customer = await CustomerModel.getCustomerById(customerId);
      return customer && customer.shop_id === shopId;
    } catch (error) {
      logger.error('Error checking customer shop:', error.message);
      return false;
    }
  }

  /**
   * Verify that an order belongs to specific shop
   * @param {number} shopId - Shop ID
   * @param {number} orderId - Order ID
   * @returns {boolean} - True if order belongs to shop
   */
  static async isOrderInShop(shopId, orderId) {
    try {
      const order = await OrderModel.getOrderById(orderId);
      return order && order.shop_id === shopId;
    } catch (error) {
      logger.error('Error checking order shop:', error.message);
      return false;
    }
  }
}

module.exports = AuthorizationService;
