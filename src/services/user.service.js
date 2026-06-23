/**
 * User Service
 * Handles user-related business logic
 */

const UserModel = require('../models/user.model');
const logger = require('../utils/logger');

class UserService {
  /**
   * Get user profile by ID
   * @param {number} userId - User ID
   * @returns {object} - User data
   */
  static async getUserProfile(userId) {
    try {
      const user = await UserModel.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      logger.info(`Retrieved profile for user: ${userId}`);
      return user;
    } catch (error) {
      logger.error('Error getting user profile:', error.message);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {number} userId - User ID
   * @param {object} updateData - Data to update
   * @returns {object} - Updated user
   */
  static async updateUserProfile(userId, updateData) {
    try {
      const user = await UserModel.updateUser(userId, updateData);
      
      if (!user) {
        throw new Error('Failed to update user profile');
      }

      logger.info(`Updated profile for user: ${userId}`);
      return user;
    } catch (error) {
      logger.error('Error updating user profile:', error.message);
      throw error;
    }
  }

  /**
   * Get user by phone
   * @param {string} phone - Phone number
   * @returns {object} - User data
   */
  static async getUserByPhone(phone) {
    try {
      return await UserModel.getUserByPhone(phone);
    } catch (error) {
      logger.error('Error getting user by phone:', error.message);
      throw error;
    }
  }
}

module.exports = UserService;
