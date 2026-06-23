/**
 * Gallery Model
 * Handles all gallery-related database operations
 */

const db = require('../config/database');

class GalleryModel {
  /**
   * Create a new gallery item
   * @param {object} galleryData - Gallery data
   * @returns {object} - Created gallery item
   */
  static async createGalleryItem(galleryData) {
    const { shop_id, title, description, image_url, category, tags, is_active, order_index } = galleryData;
    
    const query = `
      INSERT INTO gallery (shop_id, title, description, image_url, category, tags, is_active, order_index, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, shop_id, title, description, image_url, category, tags, is_active, order_index, created_at, updated_at;
    `;
    
    return db.queryRow(query, [
      shop_id, title || null, description || null, image_url, 
      category || null, tags || null, is_active !== false, order_index || 0
    ]);
  }

  /**
   * Get gallery item by ID
   * @param {number} galleryId - Gallery ID
   * @returns {object} - Gallery item
   */
  static async getGalleryById(galleryId) {
    const query = `
      SELECT id, shop_id, title, description, image_url, category, tags, is_active, order_index, created_at, updated_at
      FROM gallery
      WHERE id = $1;
    `;
    
    return db.queryRow(query, [galleryId]);
  }

  /**
   * Get all gallery items for a shop
   * @param {number} shopId - Shop ID
   * @param {boolean} activeOnly - Filter only active items
   * @param {string} category - Filter by category
   * @param {number} limit - Limit (default 50)
   * @param {number} offset - Offset for pagination
   * @returns {array} - Array of gallery items
   */
  static async getGalleryByShop(shopId, activeOnly = false, category = null, limit = 50, offset = 0) {
    let query = `
      SELECT id, shop_id, title, description, image_url, category, tags, is_active, order_index, created_at, updated_at
      FROM gallery
      WHERE shop_id = $1
    `;
    
    const params = [shopId];
    
    if (activeOnly) {
      query += ` AND is_active = true`;
    }
    
    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }
    
    query += ` ORDER BY order_index ASC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);
    
    return db.queryAll(query, params);
  }

  /**
   * Get gallery categories for a shop
   * @param {number} shopId - Shop ID
   * @returns {array} - Array of unique categories
   */
  static async getCategories(shopId) {
    const query = `
      SELECT DISTINCT category
      FROM gallery
      WHERE shop_id = $1 AND category IS NOT NULL
      ORDER BY category;
    `;
    
    const result = await db.queryAll(query, [shopId]);
    return result.map(row => row.category);
  }

  /**
   * Update gallery item
   * @param {number} galleryId - Gallery ID
   * @param {object} galleryData - Updated gallery data
   * @returns {object} - Updated gallery item
   */
  static async updateGalleryItem(galleryId, galleryData) {
    const { title, description, image_url, category, tags, is_active, order_index } = galleryData;
    
    const query = `
      UPDATE gallery
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          image_url = COALESCE($3, image_url),
          category = COALESCE($4, category),
          tags = COALESCE($5, tags),
          is_active = COALESCE($6, is_active),
          order_index = COALESCE($7, order_index),
          updated_at = NOW()
      WHERE id = $8
      RETURNING id, shop_id, title, description, image_url, category, tags, is_active, order_index, created_at, updated_at;
    `;
    
    return db.queryRow(query, [
      title, description, image_url, category, tags, is_active, order_index, galleryId
    ]);
  }

  /**
   * Delete gallery item
   * @param {number} galleryId - Gallery ID
   * @returns {boolean} - Success status
   */
  static async deleteGalleryItem(galleryId) {
    const query = `
      DELETE FROM gallery
      WHERE id = $1
      RETURNING id;
    `;
    
    const result = await db.queryRow(query, [galleryId]);
    return !!result;
  }

  /**
   * Get gallery count for a shop
   * @param {number} shopId - Shop ID
   * @param {boolean} activeOnly - Count only active items
   * @param {string} category - Filter by category
   * @returns {number} - Gallery count
   */
  static async getGalleryCount(shopId, activeOnly = false, category = null) {
    let query = `SELECT COUNT(*) as count FROM gallery WHERE shop_id = $1`;
    const params = [shopId];
    
    if (activeOnly) {
      query += ` AND is_active = true`;
    }
    
    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }
    
    const result = await db.queryRow(query, params);
    return parseInt(result.count, 10);
  }

  /**
   * Reorder gallery items
   * @param {number} shopId - Shop ID
   * @param {array} itemOrders - Array of {id, order_index}
   * @returns {boolean} - Success status
   */
  static async reorderItems(shopId, itemOrders) {
    for (const item of itemOrders) {
      const query = `
        UPDATE gallery
        SET order_index = $1, updated_at = NOW()
        WHERE id = $2 AND shop_id = $3
      `;
      await db.query(query, [item.order_index, item.id, shopId]);
    }
    return true;
  }
}

module.exports = GalleryModel;