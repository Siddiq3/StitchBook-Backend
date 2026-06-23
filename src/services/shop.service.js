/**
 * Shop Service
 * Handles shop-related business logic
 */

const ShopModel = require('../models/shop.model');
const logger = require('../utils/logger');

class ShopService {
  /**
   * Create a new shop for user
   * @param {number} userId - User ID from JWT
   * @param {object} shopData - Shop data {name, location, phone}
   * @returns {object} - Created shop
   */
  static async createShop(userId, shopData) {
    try {
      // Check if user already has a shop
      const existingShop = await ShopModel.getShopByUserId(userId);
      if (existingShop) {
        throw new Error('User already has a shop');
      }

      const shop = await ShopModel.createShop({
        user_id: userId,
        ...shopData,
      });

      logger.info(`Shop created for user: ${userId}`);
      return shop;
    } catch (error) {
      logger.error('Error creating shop:', error.message);
      throw error;
    }
  }

  /**
   * Get shop for user (by user ID from JWT)
   * @param {number} userId - User ID from JWT
   * @returns {object} - Shop data
   */
  static async getShopByUser(userId) {
    try {
      const shop = await ShopModel.getShopByUserId(userId);
      
      if (!shop) {
        throw new Error('Shop not found');
      }

      logger.info(`Retrieved shop for user: ${userId}`);
      return shop;
    } catch (error) {
      logger.error('Error getting shop:', error.message);
      throw error;
    }
  }

  /**
   * Get shop by ID
   * @param {number} shopId - Shop ID
   * @returns {object} - Shop data
   */
  static async getShop(shopId) {
    try {
      const shop = await ShopModel.getShopById(shopId);
      
      if (!shop) {
        throw new Error('Shop not found');
      }

      return shop;
    } catch (error) {
      logger.error('Error getting shop:', error.message);
      throw error;
    }
  }

  /**
   * Update shop details
   * @param {number} shopId - Shop ID
   * @param {object} updateData - Data to update
   * @returns {object} - Updated shop
   */
  static async updateShop(shopId, updateData) {
    try {
      const shop = await ShopModel.updateShop(shopId, updateData);
      
      if (!shop) {
        throw new Error('Failed to update shop');
      }

      logger.info(`Updated shop: ${shopId}`);
      return shop;
    } catch (error) {
      logger.error('Error updating shop:', error.message);
      throw error;
    }
  }

  /**
   * Delete shop
   * @param {number} shopId - Shop ID
   * @returns {boolean} - Success status
   */
  static async deleteShop(shopId) {
    try {
      const result = await ShopModel.deleteShop(shopId);
      
      if (!result) {
        throw new Error('Failed to delete shop');
      }

      logger.info(`Deleted shop: ${shopId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting shop:', error.message);
      throw error;
    }
  }
}

module.exports = ShopService;
