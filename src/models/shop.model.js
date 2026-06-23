/**
 * Shop Model
 * Handles all shop-related database operations
 */

const db = require('../config/database');

class ShopModel {
  /**
   * Create a new shop
   * @param {object} shopData - Shop data {user_id, name, location, phone}
   * @returns {object} - Created shop
   */
  static async createShop(shopData) {
    const { user_id, name, location, phone } = shopData;
    
    const query = `
      INSERT INTO shops (user_id, name, location, phone, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, user_id, name, location, phone, created_at, updated_at;
    `;
    
    return db.queryRow(query, [user_id, name, location, phone]);
  }

  /**
   * Get shop by ID
   * @param {number} shopId - Shop ID
   * @returns {object} - Shop data
   */
  static async getShopById(shopId) {
    const query = `
      SELECT id, user_id, name, location, phone, created_at, updated_at
      FROM shops
      WHERE id = $1;
    `;
    
    return db.queryRow(query, [shopId]);
  }

  /**
   * Get shop by user ID (each user has one shop)
   * @param {number} userId - User ID
   * @returns {object} - Shop data
   */
  static async getShopByUserId(userId) {
    const query = `
      SELECT id, user_id, name, location, phone, created_at, updated_at
      FROM shops
      WHERE user_id = $1
      LIMIT 1;
    `;
    
    return db.queryRow(query, [userId]);
  }

  /**
   * Update shop
   * @param {number} shopId - Shop ID
   * @param {object} updateData - Data to update
   * @returns {object} - Updated shop
   */
  static async updateShop(shopId, updateData) {
    const allowedFields = ['name', 'location', 'phone'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return this.getShopById(shopId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(shopId);

    const query = `
      UPDATE shops
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, user_id, name, location, phone, created_at, updated_at;
    `;

    return db.queryRow(query, values);
  }

  /**
   * Delete shop
   * @param {number} shopId - Shop ID
   * @returns {boolean} - Success status
   */
  static async deleteShop(shopId) {
    const query = `
      DELETE FROM shops
      WHERE id = $1;
    `;
    
    const result = await db.query(query, [shopId]);
    return result.rowCount > 0;
  }
}

module.exports = ShopModel;
