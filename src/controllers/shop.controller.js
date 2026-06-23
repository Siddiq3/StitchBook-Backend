/**
 * Shop Controller
 * Handles shop-related HTTP requests
 * Security: All operations use authenticated user's ID, not shopId from request
 */

const ShopService = require('../services/shop.service');
const AuthorizationService = require('../services/authorization.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

/**
 * POST /shop
 * Create a new shop for the authenticated user
 * Security: User can only create ONE shop (enforced by service)
 */
exports.createShop = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, location, phone } = req.body;

    // Validate request
    if (!name || !phone) {
      return responder.error(res, 400, 'Shop name and phone are required');
    }

    const shop = await ShopService.createShop(userId, {
      name,
      location: location || null,
      phone,
    });

    logger.info(`Shop created by user: ${userId}`);
    responder.success(res, 201, 'Shop created', shop);
  } catch (error) {
    logger.error('Create shop error:', error.message);
    if (error.message.includes('already has a shop')) {
      responder.error(res, 400, error.message);
    } else {
      responder.error(res, 500, error.message);
    }
  }
};

/**
 * GET /shop
 * Get authenticated user's shop
 * Security: Uses user ID from JWT, not shopId from request
 */
exports.getShop = async (req, res) => {
  try {
    const userId = req.user.id;

    const shop = await ShopService.getShopByUser(userId);
    responder.success(res, 200, 'Shop retrieved', shop);
  } catch (error) {
    logger.error('Get shop error:', error.message);
    responder.error(res, 404, error.message);
  }
};

/**
 * PUT /shop
 * Update authenticated user's shop
 * Security: Uses user ID from JWT to find shop, not shopId from request
 */
exports.updateShop = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Get user's shop first (to get shopId)
    const shop = await AuthorizationService.getUserShop(userId);

    const updatedShop = await ShopService.updateShop(shop.id, updateData);
    responder.success(res, 200, 'Shop updated', updatedShop);
  } catch (error) {
    logger.error('Update shop error:', error.message);
    responder.error(res, 500, 'Failed to update shop', error.message);
  }
};

/**
 * DELETE /shop
 * Delete authenticated user's shop
 * Security: Uses user ID from JWT to find shop, not shopId from request
 */
exports.deleteShop = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's shop first (to get shopId)
    const shop = await AuthorizationService.getUserShop(userId);

    await ShopService.deleteShop(shop.id);
    responder.success(res, 200, 'Shop deleted');
  } catch (error) {
    logger.error('Delete shop error:', error.message);
    responder.error(res, 500, 'Failed to delete shop', error.message);
  }
};
