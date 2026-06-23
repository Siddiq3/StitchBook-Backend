/**
 * Staff Model
 * Handles all staff-related database operations
 */

const db = require('../config/database');
const { normalizeRole } = require('../services/permissions.service');
const phoneUtils = require('../utils/phoneUtils');

class StaffModel {
  /**
   * Create a new staff member
   * @param {object} staffData - Staff data
   * @returns {object} - Created staff member
   */
  static async createStaff(staffData) {
    const { 
      shop_id, name, phone, email, role, salary, commission_rate, 
      payment_type, pay_rate, aadhar_number, address, photo_url, is_active, joined_date,
      user_id, can_login, access_role, permissions
    } = staffData;
    const normalizedAccessRole = normalizeRole(access_role || role);
    const normalizedPhone = phone ? phoneUtils.normalizePhone(phone) : null;
    
    const query = `
      INSERT INTO staff (
        shop_id, name, phone, email, role, salary, commission_rate,
        payment_type, pay_rate, aadhar_number, address, photo_url, is_active, joined_date,
        user_id, can_login, access_role, permissions,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
      RETURNING id, shop_id, name, phone, email, role, salary, commission_rate,
                payment_type, pay_rate, aadhar_number, address, photo_url, is_active, joined_date,
                user_id, can_login, access_role, permissions,
                created_at, updated_at;
    `;
    
    return db.queryRow(query, [
      shop_id, name, normalizedPhone, email || null, role || 'tailor',
      salary || null, commission_rate || 0, payment_type || 'monthly',
      pay_rate ?? salary ?? 0, aadhar_number || null,
      address || null, photo_url || null, is_active !== false, joined_date || null,
      user_id || null,
      can_login !== undefined ? can_login : ['manager', 'cutter', 'delivery'].includes(normalizedAccessRole),
      normalizedAccessRole,
      JSON.stringify(permissions || {})
    ]);
  }

  /**
   * Get staff by ID
   * @param {number} staffId - Staff ID
   * @returns {object} - Staff data
   */
  static async getStaffById(staffId) {
    const query = `
      SELECT id, shop_id, name, phone, email, role, salary, commission_rate,
             payment_type, pay_rate, aadhar_number, address, photo_url, is_active, joined_date,
             user_id, can_login, access_role, permissions,
             CASE
               WHEN payment_type = 'monthly' THEN COALESCE(pay_rate, salary, 0)
               ELSE COALESCE((
                 SELECT SUM(amount)
                 FROM staff_work_logs
                 WHERE staff_id = staff.id
                   AND date_trunc('month', work_date) = date_trunc('month', CURRENT_DATE)
               ), 0)
             END AS current_month_earnings,
             COALESCE((
               SELECT COUNT(*)
               FROM staff_work_logs
               WHERE staff_id = staff.id
             ), 0) AS work_entries_count,
             created_at, updated_at
      FROM staff
      WHERE id = $1;
    `;
    
    return db.queryRow(query, [staffId]);
  }

  /**
   * Get all staff for a shop
   * @param {number} shopId - Shop ID
   * @param {boolean} activeOnly - Filter only active staff
   * @param {number} limit - Limit (default 100)
   * @param {number} offset - Offset for pagination
   * @returns {array} - Array of staff members
   */
  static async getStaffByShop(shopId, activeOnly = false, limit = 100, offset = 0) {
    let query = `
      SELECT id, shop_id, name, phone, email, role, salary, commission_rate,
             payment_type, pay_rate, aadhar_number, address, photo_url, is_active, joined_date,
             user_id, can_login, access_role, permissions,
             CASE
               WHEN payment_type = 'monthly' THEN COALESCE(pay_rate, salary, 0)
               ELSE COALESCE((
                 SELECT SUM(amount)
                 FROM staff_work_logs
                 WHERE staff_id = staff.id
                   AND date_trunc('month', work_date) = date_trunc('month', CURRENT_DATE)
               ), 0)
             END AS current_month_earnings,
             COALESCE((
               SELECT COUNT(*)
               FROM staff_work_logs
               WHERE staff_id = staff.id
             ), 0) AS work_entries_count,
             created_at, updated_at
      FROM staff
      WHERE shop_id = $1
    `;
    
    const params = [shopId];
    
    if (activeOnly) {
      query += ` AND is_active = true`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3;`;
    params.push(limit, offset);
    
    return db.queryAll(query, params);
  }

  /**
   * Update staff member
   * @param {number} staffId - Staff ID
   * @param {object} staffData - Updated staff data
   * @returns {object} - Updated staff member
   */
  static async updateStaff(staffId, staffData) {
    const { 
      name, phone, email, role, salary, commission_rate, 
      payment_type, pay_rate, aadhar_number, address, photo_url, is_active, joined_date,
      user_id, can_login, access_role, permissions
    } = staffData;
    const normalizedAccessRole = access_role || role ? normalizeRole(access_role || role) : null;
    const normalizedPhone = phone ? phoneUtils.normalizePhone(phone) : null;
    
    const query = `
      UPDATE staff
      SET name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          email = COALESCE($3, email),
          role = COALESCE($4, role),
          salary = COALESCE($5, salary),
          commission_rate = COALESCE($6, commission_rate),
          payment_type = COALESCE($7, payment_type),
          pay_rate = COALESCE($8, pay_rate),
          aadhar_number = COALESCE($9, aadhar_number),
          address = COALESCE($10, address),
          photo_url = COALESCE($11, photo_url),
          is_active = COALESCE($12, is_active),
          joined_date = COALESCE($13, joined_date),
          user_id = COALESCE($14, user_id),
          can_login = COALESCE($15, can_login),
          access_role = COALESCE($16, access_role),
          permissions = COALESCE($17::jsonb, permissions),
          updated_at = NOW()
      WHERE id = $18
      RETURNING id, shop_id, name, phone, email, role, salary, commission_rate,
                payment_type, pay_rate, aadhar_number, address, photo_url, is_active, joined_date,
                user_id, can_login, access_role, permissions,
                created_at, updated_at;
    `;
    
    return db.queryRow(query, [
      name, normalizedPhone, email, role, salary, commission_rate,
      payment_type, pay_rate, aadhar_number, address, photo_url, is_active, joined_date,
      user_id, can_login, normalizedAccessRole,
      permissions === undefined ? null : JSON.stringify(permissions),
      staffId
    ]);
  }

  /**
   * Delete staff member (soft delete - just set inactive)
   * @param {number} staffId - Staff ID
   * @returns {boolean} - Success status
   */
  static async deleteStaff(staffId) {
    const query = `
      UPDATE staff
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING id;
    `;
    
    const result = await db.queryRow(query, [staffId]);
    return !!result;
  }

  /**
   * Get staff count for a shop
   * @param {number} shopId - Shop ID
   * @param {boolean} activeOnly - Count only active staff
   * @returns {number} - Staff count
   */
  static async getStaffCount(shopId, activeOnly = false) {
    let query = `SELECT COUNT(*) as count FROM staff WHERE shop_id = $1`;
    const params = [shopId];
    
    if (activeOnly) {
      query += ` AND is_active = true`;
    }
    
    const result = await db.queryRow(query, params);
    return parseInt(result.count, 10);
  }

  /**
   * Get staff by role
   * @param {number} shopId - Shop ID
   * @param {string} role - Staff role
   * @returns {array} - Array of staff members
   */
  static async getStaffByRole(shopId, role) {
    const query = `
      SELECT id, shop_id, name, phone, email, role, salary, commission_rate,
             payment_type, pay_rate, aadhar_number, address, photo_url, is_active, joined_date,
             user_id, can_login, access_role, permissions,
             created_at, updated_at
      FROM staff
      WHERE shop_id = $1 AND role = $2 AND is_active = true
      ORDER BY name;
    `;
    
    return db.queryAll(query, [shopId, role]);
  }

  static async getStaffByPhone(phone) {
    const normalizedPhone = phoneUtils.normalizePhone(phone);
    const localPhone = normalizedPhone.startsWith('+91') ? normalizedPhone.slice(3) : normalizedPhone;
    const query = `
      SELECT id, shop_id, user_id, name, phone, email, role, is_active,
             can_login, access_role, permissions, payment_type, pay_rate
      FROM staff
      WHERE phone = $1 OR phone = $2
      LIMIT 1;
    `;

    return db.queryRow(query, [normalizedPhone, localPhone]);
  }

  static async getStaffByUserId(userId) {
    const query = `
      SELECT id, shop_id, user_id, name, phone, email, role, is_active,
             can_login, access_role, permissions, payment_type, pay_rate
      FROM staff
      WHERE user_id = $1 AND is_active = true
      LIMIT 1;
    `;

    return db.queryRow(query, [userId]);
  }

  static async getStaffByEmail(email) {
    const query = `
      SELECT id, shop_id, user_id, name, phone, email, role, is_active,
             can_login, access_role, permissions, payment_type, pay_rate
      FROM staff
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `;

    return db.queryRow(query, [email]);
  }

  static async getAssignedOrders(staffId, role, filters = {}) {
    const { limit = 100, offset = 0, status } = filters;
    const staff = await this.getStaffById(staffId);
    if (!staff) return [];

    const params = [staffId, staff.shop_id];
    const where = ['o.shop_id = $2'];
    if (status) {
      params.push(status);
      where.push(`o.status = $${params.length}`);
    }

    const staffField = role === 'cutter' ? 'cutter_staff_id' : 'stitcher_staff_id';
    const legacyField = role === 'cutter' ? 'assigned_cutter_id' : 'assigned_stitcher_id';
    params.push(limit, offset);

    const query = `
      SELECT
        o.id,
        o.order_number,
        o.customer_id,
        o.shop_id,
        o.status,
        o.delivery_date,
        o.total_amount,
        o.advance_paid,
        o.balance_due,
        o.created_at,
        o.updated_at,
        c.name AS customer_name,
        c.phone AS customer_phone,
        item.value AS item,
        item.ordinality::int - 1 AS item_index
      FROM orders o
      JOIN LATERAL jsonb_array_elements(COALESCE(o.items::jsonb, '[]'::jsonb))
        WITH ORDINALITY AS item(value, ordinality) ON true
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE ${where.join(' AND ')}
        AND (
          item.value->>'${staffField}' = $1::text
          OR item.value->>'${legacyField}' = $1::text
        )
      ORDER BY o.delivery_date ASC NULLS LAST, o.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length};
    `;

    return db.queryAll(query, params);
  }

  static async linkStaffUser(staffId, userId) {
    const query = `
      UPDATE staff
      SET user_id = $2, updated_at = NOW()
      WHERE id = $1 AND (user_id IS NULL OR user_id = $2)
      RETURNING id, shop_id, user_id, name, phone, email, role, is_active,
                can_login, access_role, permissions;
    `;

    return db.queryRow(query, [staffId, userId]);
  }

  /**
   * Create a staff work log entry.
   * @param {object} workData - Staff work details
   * @returns {object} - Created work log
   */
  static async createWorkLog(workData) {
    const {
      shop_id,
      staff_id,
      order_id,
      order_number,
      item_name,
      item_type,
      item_price,
      quantity,
      rate,
      amount,
      work_date,
      status,
      notes,
    } = workData;

    const quantityValue = Number(quantity || 1);
    const staff = await this.getStaffById(staff_id);
    const paymentType = staff?.payment_type || 'monthly';
    const rateValue = rate === undefined || rate === null || rate === ''
      ? Number(staff?.pay_rate ?? staff?.salary ?? 0)
      : Number(rate);
    const itemPriceValue = item_price === undefined || item_price === null || item_price === ''
      ? null
      : Number(item_price);

    let amountValue = 0;
    if (paymentType === 'per_piece') {
      amountValue = quantityValue * rateValue;
    } else if (paymentType === 'commission') {
      amountValue = ((itemPriceValue || 0) * quantityValue * rateValue) / 100;
    } else if (paymentType === 'daily') {
      const existingDayLog = await db.queryRow(
        `
          SELECT id
          FROM staff_work_logs
          WHERE staff_id = $1
            AND work_date = COALESCE($2::date, CURRENT_DATE)
          LIMIT 1;
        `,
        [staff_id, work_date || null]
      );
      amountValue = existingDayLog ? 0 : rateValue;
    }

    const query = `
      INSERT INTO staff_work_logs (
        shop_id, staff_id, order_id, order_number, item_name, item_type, item_price,
        quantity, rate, amount, work_date, status, notes, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::date, CURRENT_DATE), $12, $13, NOW(), NOW())
      RETURNING id, shop_id, staff_id, order_id, order_number, item_name, item_type, item_price,
                quantity, rate, amount, work_date, status, notes, created_at, updated_at;
    `;

    return db.queryRow(query, [
      shop_id,
      staff_id,
      order_id || null,
      order_number || null,
      item_name,
      item_type || null,
      itemPriceValue,
      quantityValue,
      rateValue,
      amountValue,
      work_date || null,
      status || 'completed',
      notes || null,
    ]);
  }

  /**
   * Get work logs for a staff member.
   * @param {number} staffId - Staff ID
   * @param {object} filters - Optional filters
   * @returns {array} - Work log entries
   */
  static async getWorkLogsByStaff(staffId, filters = {}) {
    const { start_date, end_date, status, limit = 100, offset = 0 } = filters;
    const params = [staffId];
    const where = ['swl.staff_id = $1'];

    if (start_date) {
      params.push(start_date);
      where.push(`swl.work_date >= $${params.length}`);
    }

    if (end_date) {
      params.push(end_date);
      where.push(`swl.work_date <= $${params.length}`);
    }

    if (status) {
      params.push(status);
      where.push(`swl.status = $${params.length}`);
    }

    params.push(limit, offset);

    const query = `
      SELECT swl.id, swl.shop_id, swl.staff_id, swl.order_id,
             COALESCE(swl.order_number, o.order_number) AS order_number,
             swl.item_name, swl.item_type, swl.item_price, swl.quantity, swl.rate, swl.amount,
             swl.work_date, swl.status, swl.notes, swl.created_at, swl.updated_at,
             c.name AS customer_name
      FROM staff_work_logs swl
      LEFT JOIN orders o ON swl.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE ${where.join(' AND ')}
      ORDER BY swl.work_date DESC, swl.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length};
    `;

    return db.queryAll(query, params);
  }

  /**
   * Get a single work log entry.
   * @param {number} workLogId - Work log ID
   * @returns {object} - Work log entry
   */
  static async getWorkLogById(workLogId) {
    const query = `
      SELECT id, shop_id, staff_id, order_id, order_number, item_name, item_type,
             item_price, quantity, rate, amount, work_date, status, notes,
             created_at, updated_at
      FROM staff_work_logs
      WHERE id = $1;
    `;

    return db.queryRow(query, [workLogId]);
  }

  /**
   * Delete a work log entry and rebalance daily wage if needed.
   * @param {number} staffId - Staff ID
   * @param {number} workLogId - Work log ID
   * @returns {object} - Deleted work log
   */
  static async deleteWorkLog(staffId, workLogId) {
    const workLog = await this.getWorkLogById(workLogId);
    if (!workLog || Number(workLog.staff_id) !== Number(staffId)) {
      return null;
    }

    const staff = await this.getStaffById(staffId);

    const deleted = await db.queryRow(
      `
        DELETE FROM staff_work_logs
        WHERE id = $1 AND staff_id = $2
        RETURNING id, shop_id, staff_id, order_id, order_number, item_name,
                  item_type, item_price, quantity, rate, amount, work_date,
                  status, notes, created_at, updated_at;
      `,
      [workLogId, staffId]
    );

    if (
      deleted &&
      staff?.payment_type === 'daily' &&
      Number(deleted.amount || 0) > 0
    ) {
      await db.queryRow(
        `
          UPDATE staff_work_logs
          SET amount = rate, updated_at = NOW()
          WHERE id = (
            SELECT id
            FROM staff_work_logs
            WHERE staff_id = $1 AND work_date = $2
            ORDER BY created_at ASC
            LIMIT 1
          )
          RETURNING id;
        `,
        [staffId, deleted.work_date]
      );
    }

    return deleted;
  }

  /**
   * Summarize earnings and item volume for a staff member.
   * @param {number} staffId - Staff ID
   * @param {object} filters - Optional date filters
   * @returns {object} - Staff earnings summary
   */
  static async getWorkSummary(staffId, filters = {}) {
    const { start_date, end_date } = filters;
    const params = [staffId];
    const where = ['staff_id = $1'];

    if (start_date) {
      params.push(start_date);
      where.push(`work_date >= $${params.length}`);
    }

    if (end_date) {
      params.push(end_date);
      where.push(`work_date <= $${params.length}`);
    }

    const totalsQuery = `
      SELECT
        COUNT(*)::int AS entries_count,
        COALESCE(SUM(quantity), 0)::int AS total_quantity,
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount,
        COALESCE(SUM(CASE WHEN status <> 'paid' THEN amount ELSE 0 END), 0) AS unpaid_amount
      FROM staff_work_logs
      WHERE ${where.join(' AND ')};
    `;

    const byItemQuery = `
      SELECT item_name, COALESCE(SUM(quantity), 0)::int AS quantity,
             COALESCE(SUM(amount), 0) AS amount
      FROM staff_work_logs
      WHERE ${where.join(' AND ')}
      GROUP BY item_name
      ORDER BY amount DESC, item_name
      LIMIT 10;
    `;

    const [staff, totals, byItem] = await Promise.all([
      this.getStaffById(staffId),
      db.queryRow(totalsQuery, params),
      db.queryAll(byItemQuery, params),
    ]);

    if (staff?.payment_type === 'monthly') {
      const monthlyPay = Number(staff.pay_rate ?? staff.salary ?? 0);
      totals.total_amount = monthlyPay;
      totals.unpaid_amount = monthlyPay - Number(totals.paid_amount || 0);
    }

    return {
      ...totals,
      by_item: byItem,
    };
  }
}

module.exports = StaffModel;
