/**
 * Authorization Service
 * Validates that resources belong to the authenticated user's shop
 * Implements multi-tenant security checks
 */

const ShopModel = require('../models/shop.model');
const UserModel = require('../models/user.model');
const StaffModel = require('../models/staff.model');
const CustomerModel = require('../models/customer.model');
const OrderModel = require('../models/order.model');
const MeasurementModel = require('../models/measurement.model');
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
      // Get user's shop
      const shop = await ShopModel.getShopByUserId(userId);
      let effectiveShop = shop;

      if (!effectiveShop) {
        const user = await UserModel.getUserById(userId);
        if (user?.shop_id) {
          effectiveShop = await ShopModel.getShopById(user.shop_id);
        }
      }

      if (!effectiveShop) {
        const staff = await StaffModel.getStaffByUserId(userId);
        if (staff?.shop_id) {
          effectiveShop = await ShopModel.getShopById(staff.shop_id);
        }
      }

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
      // Get user's shop
      const shop = await ShopModel.getShopByUserId(userId);
      let effectiveShop = shop;

      if (!effectiveShop) {
        const user = await UserModel.getUserById(userId);
        if (user?.shop_id) {
          effectiveShop = await ShopModel.getShopById(user.shop_id);
        }
      }

      if (!effectiveShop) {
        const staff = await StaffModel.getStaffByUserId(userId);
        if (staff?.shop_id) {
          effectiveShop = await ShopModel.getShopById(staff.shop_id);
        }
      }

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
      // Get user's shop
      const shop = await ShopModel.getShopByUserId(userId);
      let effectiveShop = shop;

      if (!effectiveShop) {
        const user = await UserModel.getUserById(userId);
        if (user?.shop_id) {
          effectiveShop = await ShopModel.getShopById(user.shop_id);
        }
      }

      if (!effectiveShop) {
        const staff = await StaffModel.getStaffByUserId(userId);
        if (staff?.shop_id) {
          effectiveShop = await ShopModel.getShopById(staff.shop_id);
        }
      }

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
      const shop = await ShopModel.getShopByUserId(userId);
      if (shop) {
        return shop;
      }

      const user = await UserModel.getUserById(userId);
      if (user?.shop_id) {
        const staffShop = await ShopModel.getShopById(user.shop_id);
        if (staffShop) return staffShop;
      }

      const staff = await StaffModel.getStaffByUserId(userId);
      if (staff?.shop_id) {
        const staffShop = await ShopModel.getShopById(staff.shop_id);
        if (staffShop) return staffShop;
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
