/**
 * Portfolio Model
 * Handles all portfolio-related database operations
 */

const db = require('../config/database');

class PortfolioModel {
  /**
   * Create portfolio item
   * @param {object} portfolioData - Portfolio data
   * @returns {object} - Created portfolio item
   */
  static async createPortfolioItem(portfolioData) {
    const { shop_id, image_url, category, title } = portfolioData;
    
    const query = `
      INSERT INTO portfolio (shop_id, image_url, category, title, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, shop_id, image_url, category, title, created_at;
    `;
    
    return db.queryRow(query, [shop_id, image_url, category || null, title || null]);
  }

  /**
   * Get portfolio items for a shop
   * @param {number} shopId - Shop ID
   * @param {string} category - Filter by category (optional)
   * @returns {array} - Array of portfolio items
   */
  static async getPortfolioByShop(shopId, category = null) {
    let query = `
      SELECT id, shop_id, image_url, category, title, created_at
      FROM portfolio
      WHERE shop_id = $1
    `;
    
    const params = [shopId];
    
    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }
    
    query += ` ORDER BY created_at DESC;`;
    
    return db.queryAll(query, params);
  }

  /**
   * Get portfolio item by ID
   * @param {number} portfolioId - Portfolio ID
   * @returns {object} - Portfolio item
   */
  static async getPortfolioById(portfolioId) {
    const query = `
      SELECT id, shop_id, image_url, category, title, created_at
      FROM portfolio
      WHERE id = $1;
    `;
    
    return db.queryRow(query, [portfolioId]);
  }

  /**
   * Delete portfolio item
   * @param {number} portfolioId - Portfolio ID
   * @returns {boolean} - Success status
   */
  static async deletePortfolio(portfolioId) {
    const query = `
      DELETE FROM portfolio
      WHERE id = $1;
    `;
    
    const result = await db.query(query, [portfolioId]);
    return result.rowCount > 0;
  }
}

module.exports = PortfolioModel;
