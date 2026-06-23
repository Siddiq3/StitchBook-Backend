/**
 * Measurement Model
 * Handles all measurement-related database operations
 * Supports dynamic measurement fields as JSON
 */

const db = require('../config/database');
const logger = require('../utils/logger');

// Helper function to safely parse measurements_data
// PostgreSQL JSONB returns objects automatically, strings need parsing
const safeParseMeasurements = (data) => {
  if (!data) return data;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (err) {
      logger.error('Failed to parse measurements_data:', err);
      return data;
    }
  }
  return data; // Already an object
};

class MeasurementModel {
  /**
   * Create a new measurement record
   * @param {object} measurementData - Measurement data {customer_id, measurements_data, outfit_type, outfit_label}
   * @returns {object} - Created measurement record
   */
  static async createMeasurement(measurementData) {
    const { customer_id, measurements_data, outfit_type, outfit_label } = measurementData;
    
    const query = `
      INSERT INTO measurements (customer_id, measurements_data, outfit_type, outfit_label, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, customer_id, measurements_data, outfit_type, outfit_label, created_at, updated_at;
    `;
    
    const result = await db.queryRow(query, [customer_id, JSON.stringify(measurements_data), outfit_type || null, outfit_label || null]);
    if (result && result.measurements_data) {
      result.measurements_data = safeParseMeasurements(result.measurements_data);
    }
    return result;
  }

  /**
   * Get latest measurement for a customer
   * @param {number} customerId - Customer ID
   * @returns {object} - Latest measurement record
   */
  static async getLatestMeasurement(customerId) {
    const query = `
      SELECT id, customer_id, measurements_data, outfit_type, outfit_label, created_at, updated_at
      FROM measurements
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    
    const result = await db.queryRow(query, [customerId]);
    if (result && result.measurements_data) {
      result.measurements_data = safeParseMeasurements(result.measurements_data);
    }
    return result;
  }

  /**
   * Get all measurements for a customer
   * @param {number} customerId - Customer ID
   * @returns {array} - Array of measurement records
   */
  static async getMeasurementsByCustomer(customerId, outfitType = null) {
    let query = `
      SELECT id, customer_id, measurements_data, outfit_type, outfit_label, created_at, updated_at
      FROM measurements
      WHERE customer_id = $1
    `;
    const values = [customerId];

    if (outfitType) {
      query += ` AND LOWER(outfit_type) = LOWER($2)`;
      values.push(outfitType);
    }

    query += `
      ORDER BY created_at DESC;
    `;

    const results = await db.queryAll(query, values);
    return results.map(r => ({
      ...r,
      measurements_data: safeParseMeasurements(r.measurements_data),
    }));
  }

  /**
   * Get measurement by ID
   * @param {number} measurementId - Measurement ID
   * @returns {object} - Measurement record
   */
  static async getMeasurementById(measurementId) {
    const query = `
      SELECT id, customer_id, measurements_data, outfit_type, outfit_label, created_at, updated_at
      FROM measurements
      WHERE id = $1;
    `;
    
    const result = await db.queryRow(query, [measurementId]);
    if (result && result.measurements_data) {
      result.measurements_data = safeParseMeasurements(result.measurements_data);
    }
    return result;
  }

  /**
   * Update measurement
   * @param {number} measurementId - Measurement ID
   * @param {object} updateData - Data to update (measurements_data, outfit_type, outfit_label)
   * @returns {object} - Updated measurement
   */
  static async updateMeasurement(measurementId, updateData) {
    const { measurements_data, outfit_type, outfit_label } = updateData;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (measurements_data !== undefined) {
      updates.push(`measurements_data = $${paramCount}`);
      values.push(JSON.stringify(measurements_data));
      paramCount++;
    }
    
    if (outfit_type !== undefined) {
      updates.push(`outfit_type = $${paramCount}`);
      values.push(outfit_type);
      paramCount++;
    }
    
    if (outfit_label !== undefined) {
      updates.push(`outfit_label = $${paramCount}`);
      values.push(outfit_label);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return this.getMeasurementById(measurementId);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(measurementId);
    
    const query = `
      UPDATE measurements
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, customer_id, measurements_data, outfit_type, outfit_label, created_at, updated_at;
    `;
    
    const result = await db.queryRow(query, values);
    if (result && result.measurements_data) {
      result.measurements_data = safeParseMeasurements(result.measurements_data);
    }
    return result;
  }

  /**
   * Delete measurement
   * @param {number} measurementId - Measurement ID
   * @returns {boolean} - Success status
   */
  static async deleteMeasurement(measurementId) {
    const query = `
      DELETE FROM measurements
      WHERE id = $1;
    `;
    
    const result = await db.query(query, [measurementId]);
    return result.rowCount > 0;
  }
}

module.exports = MeasurementModel;
