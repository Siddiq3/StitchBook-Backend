/**
 * Order Model
 * Handles all order-related database operations
 * Supports flexible items array as JSONB
 */

const db = require('../config/database');

class OrderModel {
  static measurementSnapshotSupported = null;

  static async hasMeasurementSnapshotColumn() {
    if (this.measurementSnapshotSupported !== null) {
      return this.measurementSnapshotSupported;
    }

    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'orders'
          AND column_name = 'measurement_snapshot'
      ) AS exists;
    `;
    const result = await db.queryRow(query);
    this.measurementSnapshotSupported = Boolean(result?.exists);
    return this.measurementSnapshotSupported;
  }

  /**
   * Generate order number
   * @param {number} shopId - Shop ID
   * @returns {string} - Generated order number
   */
  static async generateOrderNumber(shopId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${shopId}-${year}${month}${day}-${random}`;
  }

  /**
   * Create a new order with items array
   * @param {object} orderData - Order data {customer_id, shop_id, items, delivery_date, description, advance_paid, notes, priority, measurement_id}
   * @returns {object} - Created order with measurement data
   */
  static async createOrder(orderData) {
    const {
      customer_id,
      shop_id,
      items,
      delivery_date,
      description,
      advance_paid,
      notes,
      priority,
      measurement_id,
      measurement_snapshot,
      order_type,
    } = orderData;

    const supportsSnapshot = await this.hasMeasurementSnapshotColumn();

    // Calculate total from items
    const total_amount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const balance_due = total_amount - (advance_paid || 0);

    // Generate order number
    const order_number = await this.generateOrderNumber(shop_id);

    const columns = [
      'order_number',
      'customer_id',
      'shop_id',
      'items',
      'total_amount',
      'status',
      'delivery_date',
      'description',
      'advance_paid',
      'balance_due',
      'notes',
      'priority',
      'measurement_id',
      'order_type',
      'created_at',
      'updated_at',
    ];

    const values = [
      order_number,
      customer_id,
      shop_id,
      JSON.stringify(items),
      total_amount,
      'pending',
      delivery_date || null,
      description || '',
      advance_paid || 0,
      balance_due,
      notes || null,
      priority || 'normal',
      measurement_id || null,
      order_type || 'stitching',
      new Date(),
      new Date(),
    ];

    if (supportsSnapshot) {
      columns.splice(columns.indexOf('order_type'), 0, 'measurement_snapshot');
      values.splice(columns.indexOf('measurement_snapshot'), 0, measurement_snapshot ? JSON.stringify(measurement_snapshot) : null);
    }

    const placeholderList = values.map((_, idx) => `$${idx + 1}`).join(', ');
    const query = `
      INSERT INTO orders (${columns.join(', ')})
      VALUES (${placeholderList})
      RETURNING id, order_number, customer_id, shop_id, items, total_amount, status,
        delivery_date, description, advance_paid, balance_due, notes, priority,
        measurement_id, ${supportsSnapshot ? 'measurement_snapshot,' : ''} order_type, created_at, updated_at;
    `;

    const result = await db.queryRow(query, values);

    if (result) {
      if (result.items) {
        result.items = typeof result.items === 'string' ? JSON.parse(result.items) : result.items;
      }
      if (supportsSnapshot && result.measurement_snapshot) {
        result.measurement_snapshot = typeof result.measurement_snapshot === 'string'
          ? JSON.parse(result.measurement_snapshot)
          : result.measurement_snapshot;
      }
    }
    return result;
  }

  /**
   * Get order by ID with measurement data
   * @param {number} orderId - Order ID
   * @returns {object} - Order data with nested measurement object
   */
  static async getOrderById(orderId) {
    const supportsSnapshot = await this.hasMeasurementSnapshotColumn();
    const query = `
      SELECT 
        o.id, o.order_number, o.customer_id, o.shop_id, o.items, o.total_amount, o.status, 
        o.delivery_date, o.description, o.advance_paid, o.balance_due, o.notes, o.priority, 
        o.measurement_id, ${supportsSnapshot ? 'o.measurement_snapshot,' : ''} o.order_type, o.created_at, o.updated_at,
        m.id as measurement_id_val, m.outfit_type, m.outfit_label, m.measurements_data
      FROM orders o
      LEFT JOIN measurements m ON o.measurement_id = m.id
      WHERE o.id = $1;
    `;
    
    const result = await db.queryRow(query, [orderId]);
    if (result) {
      // Parse items and snapshot JSON
      if (result.items) {
        result.items = typeof result.items === 'string' ? JSON.parse(result.items) : result.items;
      }
      if (supportsSnapshot && result.measurement_snapshot) {
        result.measurement_snapshot = typeof result.measurement_snapshot === 'string'
          ? JSON.parse(result.measurement_snapshot)
          : result.measurement_snapshot;
      }
      
      // Build nested measurement object if measurement exists
      if (result.measurement_id_val) {
        result.measurement = {
          id: result.measurement_id_val,
          outfitType: result.outfit_type,
          outfitLabel: result.outfit_label,
          measurementsData: typeof result.measurements_data === 'string' ? JSON.parse(result.measurements_data) : result.measurements_data
        };
      } else {
        result.measurement = null;
      }
      
      // Clean up temporary columns
      delete result.measurement_id_val;
      delete result.outfit_type;
      delete result.outfit_label;
      delete result.measurements_data;
    }
    return result;
  }

  /**
   * Get order by order number with measurement data
   * @param {string} orderNumber - Order number
   * @returns {object} - Order data with nested measurement object
   */
  static async getOrderByNumber(orderNumber) {
    const supportsSnapshot = await this.hasMeasurementSnapshotColumn();
    const query = `
      SELECT 
        o.id, o.order_number, o.customer_id, o.shop_id, o.items, o.total_amount, o.status, 
        o.delivery_date, o.description, o.advance_paid, o.balance_due, o.notes, o.priority, 
        o.measurement_id, ${supportsSnapshot ? 'o.measurement_snapshot,' : ''} o.order_type, o.created_at, o.updated_at,
        m.id as measurement_id_val, m.outfit_type, m.outfit_label, m.measurements_data
      FROM orders o
      LEFT JOIN measurements m ON o.measurement_id = m.id
      WHERE o.order_number = $1;
    `;
    
    const result = await db.queryRow(query, [orderNumber]);
    if (result) {
      // Parse items and snapshot JSON
      if (result.items) {
        result.items = typeof result.items === 'string' ? JSON.parse(result.items) : result.items;
      }
      if (supportsSnapshot && result.measurement_snapshot) {
        result.measurement_snapshot = typeof result.measurement_snapshot === 'string'
          ? JSON.parse(result.measurement_snapshot)
          : result.measurement_snapshot;
      }
      
      // Build nested measurement object if measurement exists
      if (result.measurement_id_val) {
        result.measurement = {
          id: result.measurement_id_val,
          outfitType: result.outfit_type,
          outfitLabel: result.outfit_label,
          measurementsData: typeof result.measurements_data === 'string' ? JSON.parse(result.measurements_data) : result.measurements_data
        };
      } else {
        result.measurement = null;
      }
      
      // Clean up temporary columns
      delete result.measurement_id_val;
      delete result.outfit_type;
      delete result.outfit_label;
      delete result.measurements_data;
    }
    return result;
  }

  /**
   * Get all orders for a shop
   * @param {number} shopId - Shop ID
   * @param {string} status - Filter by status (optional)
   * @param {number} limit - Limit (default 100)
   * @param {number} offset - Offset for pagination (default 0)
   * @returns {array} - Array of orders
   */
  static async getOrdersByShop(shopId, status = null, limit = 100, offset = 0) {
    const supportsSnapshot = await this.hasMeasurementSnapshotColumn();
    let query = `
      SELECT id, order_number, customer_id, shop_id, items, total_amount, status, delivery_date, description, advance_paid, balance_due, notes, priority, measurement_id, ${supportsSnapshot ? 'measurement_snapshot,' : ''} order_type, created_at, updated_at
      FROM orders
      WHERE shop_id = $1
    `;
    
    const params = [shopId];
    
    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }
    
    query += `
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    
    params.push(limit, offset);
    const results = await db.queryAll(query, params);
    
    // Parse items and snapshot JSON for each result
    return results.map((r) => ({
      ...r,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      measurement_snapshot:
        supportsSnapshot && r.measurement_snapshot && typeof r.measurement_snapshot === 'string'
          ? JSON.parse(r.measurement_snapshot)
          : r.measurement_snapshot,
    }));
  }

  /**
   * Get all orders for a customer
   * @param {number} customerId - Customer ID
   * @param {number} limit - Limit (default 100)
   * @param {number} offset - Offset for pagination (default 0)
   * @returns {array} - Array of orders
   */
  static async getOrdersByCustomer(customerId, limit = 100, offset = 0) {
    const supportsSnapshot = await this.hasMeasurementSnapshotColumn();
    const query = `
      SELECT id, order_number, customer_id, shop_id, items, total_amount, status, delivery_date, description, advance_paid, balance_due, notes, priority, measurement_id, ${supportsSnapshot ? 'measurement_snapshot,' : ''} order_type, created_at, updated_at
      FROM orders
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    
    const results = await db.queryAll(query, [customerId, limit, offset]);
    return results.map((r) => ({
      ...r,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      measurement_snapshot:
        supportsSnapshot && r.measurement_snapshot && typeof r.measurement_snapshot === 'string'
          ? JSON.parse(r.measurement_snapshot)
          : r.measurement_snapshot,
    }));
  }

  /**
   * Update order status and/or details
   * @param {number} orderId - Order ID
   * @param {object} updateData - Data to update (items, total_amount, status, delivery_date, advance_paid, balance_due, notes, priority, assigned_to)
   * @returns {object} - Updated order
   */
  static async updateOrder(orderId, updateData) {
    const supportedColumns = ['items', 'total_amount', 'status', 'delivery_date', 'advance_paid', 'balance_due', 'notes', 'priority', 'assigned_to', 'measurement_id', 'order_type'];
    const supportsSnapshot = await this.hasMeasurementSnapshotColumn();
    if (supportsSnapshot) {
      supportedColumns.push('measurement_snapshot');
    }
    const allowedFields = supportedColumns;
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        // Handle items array - stringify if it's an array
        const finalValue = key === 'items' ? JSON.stringify(value) : value;
        updates.push(`${key} = $${paramCount}`);
        values.push(finalValue);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return this.getOrderById(orderId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(orderId);

    const query = `
      UPDATE orders
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, order_number, customer_id, shop_id, items, total_amount, status, delivery_date, description, advance_paid, balance_due, notes, priority, measurement_id, ${supportsSnapshot ? 'measurement_snapshot,' : ''} created_at, updated_at;
    `;

    const result = await db.queryRow(query, values);
    if (result) {
      if (result.items) {
        result.items = typeof result.items === 'string' ? JSON.parse(result.items) : result.items;
      }
      if (supportsSnapshot && result.measurement_snapshot) {
        result.measurement_snapshot = typeof result.measurement_snapshot === 'string'
          ? JSON.parse(result.measurement_snapshot)
          : result.measurement_snapshot;
      }
    }
    return result;
  }

  /**
   * Delete order
   * @param {number} orderId - Order ID
   * @returns {boolean} - Success status
   */
  static async deleteOrder(orderId) {
    const query = `
      DELETE FROM orders
      WHERE id = $1;
    `;
    
    const result = await db.query(query, [orderId]);
    return result.rowCount > 0;
  }

  /**
   * Get order count by status for a shop
   * @param {number} shopId - Shop ID
   * @param {string} status - Status to count
   * @returns {number} - Count
   */
  static async getOrderCountByStatus(shopId, status) {
    const query = `
      SELECT COUNT(*) as count
      FROM orders
      WHERE shop_id = $1 AND status = $2;
    `;
    
    const result = await db.queryRow(query, [shopId, status]);
    return result ? parseInt(result.count) : 0;
  }
}

module.exports = OrderModel;
