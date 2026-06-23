/**
 * User Controller
 * Handles user-related HTTP requests
 */

const UserService = require('../services/user.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

/**
 * GET /user/profile
 * Get user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const user = await UserService.getUserProfile(userId);
    responder.success(res, 200, 'Profile retrieved', user);
  } catch (error) {
    logger.error('Get profile error:', error.message);
    responder.error(res, 404, error.message);
  }
};

/**
 * PUT /user/profile
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const updateData = req.body;

    const user = await UserService.updateUserProfile(userId, updateData);
    responder.success(res, 200, 'Profile updated', user);
  } catch (error) {
    logger.error('Update profile error:', error.message);
    responder.error(res, 500, 'Failed to update profile', error.message);
  }
};

/**
 * GET /user/by-phone/:phone
 * Get user by phone number (admin use)
 */
exports.getUserByPhone = async (req, res) => {
  try {
    const { phone } = req.params;

    const user = await UserService.getUserByPhone(phone);
    
    if (!user) {
      return responder.error(res, 404, 'User not found');
    }

    responder.success(res, 200, 'User retrieved', user);
  } catch (error) {
    logger.error('Get user by phone error:', error.message);
    responder.error(res, 500, 'Failed to get user', error.message);
  }
};
