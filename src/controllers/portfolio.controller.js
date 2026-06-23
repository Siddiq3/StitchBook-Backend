/**
 * Portfolio Controller
 * Handles portfolio-related HTTP requests
 */

const PortfolioService = require('../services/portfolio.service');
const AuthorizationService = require('../services/authorization.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

/**
 * POST /portfolio
 * Create a new portfolio item
 */
exports.createPortfolioItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { imageUrl, category, title } = req.body;

    if (!imageUrl) {
      return responder.error(res, 400, 'Image URL is required');
    }

    // Get user's shop
    const shop = await AuthorizationService.getUserShop(userId);

    // Create portfolio item
    const item = await PortfolioService.createPortfolioItem(shop.id, {
      image_url: imageUrl,
      category: category || null,
      title: title || null,
    });

    logger.info(`Portfolio item created for shop: ${shop.id} by user: ${userId}`);
    responder.success(res, 201, 'Portfolio item created', item);
  } catch (error) {
    logger.error('Create portfolio item error:', error.message);
    responder.error(res, 500, error.message);
  }
};

/**
 * GET /portfolio
 * Get all portfolio items for user's shop
 */
exports.getPortfolioItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category } = req.query;

    // Get user's shop
    const shop = await AuthorizationService.getUserShop(userId);

    // Get portfolio items
    const items = await PortfolioService.getPortfolioByShop(shop.id, category);

    responder.success(res, 200, 'Portfolio items retrieved', { items });
  } catch (error) {
    logger.error('Get portfolio items error:', error.message);
    responder.error(res, 500, 'Failed to get portfolio items', error.message);
  }
};

/**
 * GET /portfolio/public/:shopId
 * Get all portfolio items for a shop (public endpoint)
 */
exports.getPublicPortfolio = async (req, res) => {
  try {
    const { shopId } = req.params;

    // Get portfolio items
    const items = await PortfolioService.getPortfolioByShop(shopId);

    responder.success(res, 200, 'Portfolio items retrieved', { items });
  } catch (error) {
    logger.error('Get public portfolio error:', error.message);
    responder.error(res, 500, 'Failed to get portfolio items', error.message);
  }
};

/**
 * DELETE /portfolio/:id
 * Delete a portfolio item
 */
exports.deletePortfolioItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: portfolioId } = req.params;

    // Get portfolio item
    const item = await PortfolioService.getPortfolioById(portfolioId);
    if (!item) {
      return responder.error(res, 404, 'Portfolio item not found');
    }

    // Get user's shop
    const shop = await AuthorizationService.getUserShop(userId);

    // Verify ownership
    if (item.shop_id !== shop.id) {
      return responder.error(res, 403, 'Unauthorized: Portfolio item does not belong to your shop');
    }

    // Delete portfolio item
    await PortfolioService.deletePortfolio(portfolioId);

    logger.info(`Portfolio item deleted: ${portfolioId} by user: ${userId}`);
    responder.success(res, 200, 'Portfolio item deleted');
  } catch (error) {
    logger.error('Delete portfolio item error:', error.message);
    responder.error(res, 500, error.message);
  }
};
