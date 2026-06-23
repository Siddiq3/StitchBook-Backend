/**
 * Portfolio Service
 * Handles portfolio business logic
 */

const PortfolioModel = require('../models/portfolio.model');
const logger = require('../utils/logger');

class PortfolioService {
  /**
   * Create portfolio item
   * @param {number} shopId - Shop ID
   * @param {object} portfolioData - Portfolio data
   * @returns {object} - Created portfolio item
   */
  static async createPortfolioItem(shopId, portfolioData) {
    try {
      const item = await PortfolioModel.createPortfolioItem({
        shop_id: shopId,
        ...portfolioData,
      });

      logger.info(`Portfolio item created for shop: ${shopId}`);
      return item;
    } catch (error) {
      logger.error('Error creating portfolio item:', error.message);
      throw error;
    }
  }

  /**
   * Get portfolio items for a shop
   * @param {number} shopId - Shop ID
   * @param {string} category - Filter by category (optional)
   * @returns {array} - Array of portfolio items
   */
  static async getPortfolioByShop(shopId, category = null) {
    try {
      const items = await PortfolioModel.getPortfolioByShop(shopId, category);
      logger.info(`Retrieved portfolio items for shop: ${shopId}`);
      return items;
    } catch (error) {
      logger.error('Error getting portfolio items:', error.message);
      throw error;
    }
  }

  /**
   * Get portfolio item by ID
   * @param {number} portfolioId - Portfolio ID
   * @returns {object} - Portfolio item
   */
  static async getPortfolioById(portfolioId) {
    try {
      const item = await PortfolioModel.getPortfolioById(portfolioId);
      if (!item) {
        throw new Error('Portfolio item not found');
      }
      return item;
    } catch (error) {
      logger.error('Error getting portfolio item:', error.message);
      throw error;
    }
  }

  /**
   * Delete portfolio item
   * @param {number} portfolioId - Portfolio ID
   * @returns {boolean} - Success status
   */
  static async deletePortfolio(portfolioId) {
    try {
      const deleted = await PortfolioModel.deletePortfolio(portfolioId);
      logger.info(`Portfolio item deleted: ${portfolioId}`);
      return deleted;
    } catch (error) {
      logger.error('Error deleting portfolio item:', error.message);
      throw error;
    }
  }
}

module.exports = PortfolioService;
