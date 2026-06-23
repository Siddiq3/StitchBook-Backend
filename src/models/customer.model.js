/**
 * Customer Model
 * Handles all customer-related database operations
 */

const db = require('../config/database');

class CustomerModel {
  /**
   * Create a new customer
   * @param {object} customerData - Customer data
   * @returns {object} - Created customer
   */
  static async createCustomer(customerData) {
    const { shop_id, name, phone, notes, gender, email, date_of_birth, photo_url } = customerData;
    
    const query = `
      INSERT INTO customers (shop_id, name, phone, notes, gender, email, date_of_birth, photo_url, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, shop_id, name, phone, notes, gender, email, date_of_birth, photo_url, created_at, updated_at;
    `;
    
    return db.queryRow(query, [shop_id, name, phone, notes || null, gender || 'male', email || null, date_of_birth || null, photo_url || null]);
  }

  /**
   * Get customer by ID
   * @param {number} customerId - Customer ID
   * @returns {object} - Customer data
   */
  static async getCustomerById(customerId) {
    const query = `
      SELECT id, shop_id, name, phone, notes, gender, email, date_of_birth, photo_url, created_at, updated_at
      FROM customers
      WHERE id = $1;
    `;
    
    return db.queryRow(query, [customerId]);
  }

  /**
   * Get all customers for a shop
   * @param {number} shopId - Shop ID
   * @param {number} limit - Limit (default 100)
   * @param {number} offset - Offset for pagination (default 0)
   * @returns {array} - Array of customers
   */
  static async getCustomersByShop(shopId, limit = 100, offset = 0) {
    const query = `
      SELECT id, shop_id, name, phone, notes, gender, email, date_of_birth, photo_url, created_at, updated_at
      FROM customers
      WHERE shop_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    
    return db.queryAll(query, [shopId, limit, offset]);
  }

  /**
   * Get customer count for a shop
   * @param {number} shopId - Shop ID
   * @returns {number} - Total count
   */
  static async getCustomerCount(shopId) {
    const query = `
      SELECT COUNT(*) as count
      FROM customers
      WHERE shop_id = $1;
    `;
    
    const result = await db.queryRow(query, [shopId]);
    return result ? parseInt(result.count) : 0;
  }

  /**
   * Update customer
   * @param {number} customerId - Customer ID
   * @param {object} updateData - Data to update
   * @returns {object} - Updated customer
   */
  static async updateCustomer(customerId, updateData) {
    const allowedFields = ['name', 'phone', 'notes', 'gender', 'email', 'date_of_birth', 'photo_url'];
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
      return this.getCustomerById(customerId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(customerId);

    const query = `
      UPDATE customers
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, shop_id, name, phone, notes, gender, email, date_of_birth, photo_url, created_at, updated_at;
    `;

    return db.queryRow(query, values);
  }

  /**
   * Delete customer
   * @param {number} customerId - Customer ID
   * @returns {boolean} - Success status
   */
  static async deleteCustomer(customerId) {
    const query = `
      DELETE FROM customers
      WHERE id = $1;
    `;
    
    const result = await db.query(query, [customerId]);
    return result.rowCount > 0;
  }

  /**
   * Search customers by name or phone
   * @param {number} shopId - Shop ID
   * @param {string} searchTerm - Search term
   * @returns {array} - Matching customers
   */
  static async searchCustomers(shopId, searchTerm) {
    const query = `
      SELECT id, shop_id, name, phone, notes, gender, email, date_of_birth, photo_url, created_at, updated_at
      FROM customers
      WHERE shop_id = $1 AND (name ILIKE $2 OR phone ILIKE $2)
      ORDER BY created_at DESC
      LIMIT 50;
    `;
    
    const searchPattern = `%${searchTerm}%`;
    return db.queryAll(query, [shopId, searchPattern]);
  }
}

module.exports = CustomerModel;
