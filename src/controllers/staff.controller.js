/**
 * Staff Controller
 * Handles staff-related business logic
 */

const StaffModel = require('../models/staff.model');
const AuthorizationService = require('../services/authorization.service');
const SubscriptionModel = require('../models/subscription.model');
const { parsePagination } = require('../utils/pagination');
const logger = require('../utils/logger');

const VALID_PAYMENT_TYPES = ['monthly', 'daily', 'per_piece', 'commission'];
const VALID_WORK_STATUSES = ['assigned', 'completed', 'approved', 'paid'];
const VALID_ACCESS_ROLES = ['manager', 'cutter', 'stitcher', 'delivery', 'helper'];

class StaffController {
  static async getMyStaffProfile(req, res) {
    try {
      if (req.user.actorType !== 'staff' || !req.user.staffId) {
        return res.status(403).json({
          success: false,
          message: 'Staff login required',
          error: { code: 'STAFF_ONLY', details: {} }
        });
      }

      const staff = await StaffModel.getStaffById(req.user.staffId);
      return res.status(200).json({
        success: true,
        message: 'Staff profile retrieved successfully',
        data: staff,
        error: {}
      });
    } catch (error) {
      logger.error('Get my staff profile error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve staff profile',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  static async getMyAssignedOrders(req, res) {
    try {
      if (req.user.actorType !== 'staff' || !req.user.staffId) {
        return res.status(403).json({
          success: false,
          message: 'Staff login required',
          error: { code: 'STAFF_ONLY', details: {} }
        });
      }

      const { status } = req.query;
      const { limit, offset } = parsePagination(req, 100, 100);
      const role = req.user.role === 'cutter' ? 'cutter' : 'stitcher';
      const items = await StaffModel.getAssignedOrders(req.user.staffId, role, {
        status,
        limit,
        offset
      });

      return res.status(200).json({
        success: true,
        message: 'Assigned orders retrieved successfully',
        data: {
          role,
          orders: items
        },
        error: {}
      });
    } catch (error) {
      logger.error('Get my assigned orders error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve assigned orders',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  static async getMyWorkLogs(req, res) {
    try {
      if (req.user.actorType !== 'staff' || !req.user.staffId) {
        return res.status(403).json({
          success: false,
          message: 'Staff login required',
          error: { code: 'STAFF_ONLY', details: {} }
        });
      }

      const { start_date, end_date, status } = req.query;
      const { limit, offset } = parsePagination(req, 100, 100);
      const items = await StaffModel.getWorkLogsByStaff(req.user.staffId, {
        start_date,
        end_date,
        status,
        limit,
        offset
      });

      return res.status(200).json({
        success: true,
        message: 'Staff work logs retrieved successfully',
        data: { items },
        error: {}
      });
    } catch (error) {
      logger.error('Get my work logs error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve staff work logs',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  static async getMyWorkSummary(req, res) {
    try {
      if (req.user.actorType !== 'staff' || !req.user.staffId) {
        return res.status(403).json({
          success: false,
          message: 'Staff login required',
          error: { code: 'STAFF_ONLY', details: {} }
        });
      }

      const { start_date, end_date } = req.query;
      const summary = await StaffModel.getWorkSummary(req.user.staffId, {
        start_date,
        end_date
      });

      return res.status(200).json({
        success: true,
        message: 'Staff work summary retrieved successfully',
        data: summary,
        error: {}
      });
    } catch (error) {
      logger.error('Get my work summary error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve staff work summary',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Create a new staff member
   * POST /api/staff
   */
  static async createStaff(req, res) {
    try {
      const { 
        shop_id, name, phone, email, role, salary, commission_rate, 
        payment_type, pay_rate, aadhar_number, address, photo_url, is_active, joined_date,
        can_login, access_role, permissions
      } = req.body;

      // Validation
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'name is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      if (payment_type && !VALID_PAYMENT_TYPES.includes(payment_type)) {
        return res.status(400).json({
          success: false,
          message: `payment_type must be one of: ${VALID_PAYMENT_TYPES.join(', ')}`,
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      if (pay_rate !== undefined && (!Number.isFinite(Number(pay_rate)) || Number(pay_rate) < 0)) {
        return res.status(400).json({
          success: false,
          message: 'pay_rate cannot be negative',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      if (access_role && !VALID_ACCESS_ROLES.includes(access_role)) {
        return res.status(400).json({
          success: false,
          message: `access_role must be one of: ${VALID_ACCESS_ROLES.join(', ')}`,
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const shop = await AuthorizationService.getUserShop(req.user.id);
      const subscription = req.subscription || {};
      const features = subscription.features || SubscriptionModel.getPlanFeatures(subscription.planType);
      const maxStaff = Number(features.maxStaff ?? 0);

      if (!features.hasStaffManagement || maxStaff === 0) {
        return res.status(402).json({
          success: false,
          message: 'Staff login access is available from the Team plan. Upgrade to Team for 2 staff users or Pro for 5 staff users.',
          error: {
            code: 'STAFF_PLAN_REQUIRED',
            details: {
              planType: subscription.planType || subscription.status || 'basic',
              maxStaff,
              recommendedPlan: 'team'
            }
          }
        });
      }

      if (maxStaff > 0) {
        const activeStaffCount = await StaffModel.getStaffCount(shop.id, true);
        if (activeStaffCount >= maxStaff) {
          return res.status(402).json({
            success: false,
            message: `Your current plan allows ${maxStaff} staff user${maxStaff === 1 ? '' : 's'}. Upgrade to Pro for 5 staff users.`,
            error: {
              code: 'STAFF_LIMIT_REACHED',
              details: {
                planType: subscription.planType || 'unknown',
                maxStaff,
                activeStaffCount,
                recommendedPlan: maxStaff < 5 ? 'pro' : 'enterprise'
              }
            }
          });
        }
      }

      const staff = await StaffModel.createStaff({
        shop_id: shop.id,
        name,
        phone,
        email,
        role,
        salary,
        commission_rate,
        payment_type,
        pay_rate,
        aadhar_number,
        address,
        photo_url,
        is_active,
        joined_date,
        can_login,
        access_role,
        permissions
      });

      return res.status(201).json({
        success: true,
        message: 'Staff member created successfully',
        data: staff,
        error: {}
      });
    } catch (error) {
      logger.error('Create staff error:', error);
      
      // Handle unique constraint violations
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Staff member with this phone or email already exists',
          error: { code: 'DUPLICATE_ENTRY', details: {} }
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to create staff member',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get staff by ID
   * GET /api/staff/:id
   */
  static async getStaffById(req, res) {
    try {
      const { id } = req.params;
      const shop = await AuthorizationService.getUserShop(req.user.id);
      const staff = await StaffModel.getStaffById(id);

      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      if (staff.shop_id !== shop.id) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Staff member does not belong to your shop',
          error: { code: 'UNAUTHORIZED', details: {} }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Staff member retrieved successfully',
        data: staff,
        error: {}
      });
    } catch (error) {
      logger.error('Get staff error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve staff member',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get all staff for a shop
   * GET /api/staff
   */
  static async getStaffByShop(req, res) {
    try {
      const activeOnly = req.query.active_only === 'true';
      const { limit, offset } = parsePagination(req, 100, 100);
      const shop = await AuthorizationService.getUserShop(req.user.id);
      const staff = await StaffModel.getStaffByShop(shop.id, activeOnly, limit, offset);
      const total = await StaffModel.getStaffCount(shop.id, activeOnly);

      return res.status(200).json({
        success: true,
        message: 'Staff members retrieved successfully',
        data: {
          staff,
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + staff.length < total
          }
        },
        error: {}
      });
    } catch (error) {
      logger.error('Get staff list error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve staff members',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Update staff member
   * PUT /api/staff/:id
   */
  static async updateStaff(req, res) {
    try {
      const { id } = req.params;
      const shop = await AuthorizationService.getUserShop(req.user.id);
      const { 
        name, phone, email, role, salary, commission_rate, 
        payment_type, pay_rate, aadhar_number, address, photo_url, is_active, joined_date,
        can_login, access_role, permissions
      } = req.body;

      if (payment_type && !VALID_PAYMENT_TYPES.includes(payment_type)) {
        return res.status(400).json({
          success: false,
          message: `payment_type must be one of: ${VALID_PAYMENT_TYPES.join(', ')}`,
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      if (pay_rate !== undefined && (!Number.isFinite(Number(pay_rate)) || Number(pay_rate) < 0)) {
        return res.status(400).json({
          success: false,
          message: 'pay_rate cannot be negative',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      if (access_role && !VALID_ACCESS_ROLES.includes(access_role)) {
        return res.status(400).json({
          success: false,
          message: `access_role must be one of: ${VALID_ACCESS_ROLES.join(', ')}`,
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const existingStaff = await StaffModel.getStaffById(id);
      if (!existingStaff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      if (existingStaff.shop_id !== shop.id) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Staff member does not belong to your shop',
          error: { code: 'UNAUTHORIZED', details: {} }
        });
      }

      const staff = await StaffModel.updateStaff(id, {
        name,
        phone,
        email,
        role,
        salary,
        commission_rate,
        payment_type,
        pay_rate,
        aadhar_number,
        address,
        photo_url,
        is_active,
        joined_date,
        can_login,
        access_role,
        permissions
      });

      return res.status(200).json({
        success: true,
        message: 'Staff member updated successfully',
        data: staff,
        error: {}
      });
    } catch (error) {
      logger.error('Update staff error:', error);
      
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Staff member with this phone or email already exists',
          error: { code: 'DUPLICATE_ENTRY', details: {} }
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to update staff member',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Delete staff member (soft delete)
   * DELETE /api/staff/:id
   */
  static async deleteStaff(req, res) {
    try {
      const { id } = req.params;
      const shop = await AuthorizationService.getUserShop(req.user.id);

      const existingStaff = await StaffModel.getStaffById(id);
      if (!existingStaff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      if (existingStaff.shop_id !== shop.id) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Staff member does not belong to your shop',
          error: { code: 'UNAUTHORIZED', details: {} }
        });
      }

      await StaffModel.deleteStaff(id);

      return res.status(200).json({
        success: true,
        message: 'Staff member deleted successfully',
        data: {},
        error: {}
      });
    } catch (error) {
      logger.error('Delete staff error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete staff member',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get staff by role
   * GET /api/staff/role/:role
   */
  static async getStaffByRole(req, res) {
    try {
      const { role } = req.params;
      const shop = await AuthorizationService.getUserShop(req.user.id);
      const staff = await StaffModel.getStaffByRole(shop.id, role);

      return res.status(200).json({
        success: true,
        message: 'Staff members retrieved successfully',
        data: staff,
        error: {}
      });
    } catch (error) {
      logger.error('Get staff by role error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve staff members',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Create staff work log
   * POST /api/staff/:id/work
   */
  static async createWorkLog(req, res) {
    try {
      const { id } = req.params;
      const {
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
        notes
      } = req.body;

      if (!item_name || !item_name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'item_name is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      if (quantity !== undefined && (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0)) {
        return res.status(400).json({
          success: false,
          message: 'quantity must be greater than 0',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      if (rate !== undefined && (!Number.isFinite(Number(rate)) || Number(rate) < 0)) {
        return res.status(400).json({
          success: false,
          message: 'rate cannot be negative',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      if (
        item_price !== undefined &&
        item_price !== '' &&
        (!Number.isFinite(Number(item_price)) || Number(item_price) < 0)
      ) {
        return res.status(400).json({
          success: false,
          message: 'item_price cannot be negative',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      if (
        amount !== undefined &&
        amount !== '' &&
        (!Number.isFinite(Number(amount)) || Number(amount) < 0)
      ) {
        return res.status(400).json({
          success: false,
          message: 'amount cannot be negative',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      if (status && !VALID_WORK_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${VALID_WORK_STATUSES.join(', ')}`,
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const shop = await AuthorizationService.getUserShop(req.user.id);
      const staff = await StaffModel.getStaffById(id);

      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      if (staff.shop_id !== shop.id) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Staff member does not belong to your shop',
          error: { code: 'UNAUTHORIZED', details: {} }
        });
      }

      let linkedOrderNumber = order_number;
      if (order_id) {
        const order = await AuthorizationService.verifyOrderOwnership(req.user.id, order_id);
        linkedOrderNumber = linkedOrderNumber || order.order_number;
      }

      const workLog = await StaffModel.createWorkLog({
        shop_id: shop.id,
        staff_id: id,
        order_id,
        order_number: linkedOrderNumber,
        item_name: item_name.trim(),
        item_type,
        item_price,
        quantity,
        rate,
        amount,
        work_date,
        status,
        notes
      });

      return res.status(201).json({
        success: true,
        message: 'Staff work recorded successfully',
        data: workLog,
        error: {}
      });
    } catch (error) {
      logger.error('Create staff work log error:', error);
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          message: error.message,
          error: { code: 'UNAUTHORIZED', details: {} }
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to record staff work',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get staff work logs
   * GET /api/staff/:id/work
   */
  static async getWorkLogs(req, res) {
    try {
      const { id } = req.params;
      const { start_date, end_date, status } = req.query;
      const { limit, offset } = parsePagination(req, 100, 100);
      const shop = await AuthorizationService.getUserShop(req.user.id);
      const staff = await StaffModel.getStaffById(id);

      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      if (staff.shop_id !== shop.id) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Staff member does not belong to your shop',
          error: { code: 'UNAUTHORIZED', details: {} }
        });
      }

      const items = await StaffModel.getWorkLogsByStaff(id, {
        start_date,
        end_date,
        status,
        limit,
        offset
      });

      return res.status(200).json({
        success: true,
        message: 'Staff work logs retrieved successfully',
        data: { items },
        error: {}
      });
    } catch (error) {
      logger.error('Get staff work logs error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve staff work logs',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Delete staff work log
   * DELETE /api/staff/:id/work/:workLogId
   */
  static async deleteWorkLog(req, res) {
    try {
      const { id, workLogId } = req.params;
      const shop = await AuthorizationService.getUserShop(req.user.id);
      const staff = await StaffModel.getStaffById(id);

      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      if (staff.shop_id !== shop.id) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Staff member does not belong to your shop',
          error: { code: 'UNAUTHORIZED', details: {} }
        });
      }

      const workLog = await StaffModel.getWorkLogById(workLogId);
      if (!workLog || Number(workLog.staff_id) !== Number(id)) {
        return res.status(404).json({
          success: false,
          message: 'Work entry not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      if (workLog.shop_id !== shop.id) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Work entry does not belong to your shop',
          error: { code: 'UNAUTHORIZED', details: {} }
        });
      }

      const deleted = await StaffModel.deleteWorkLog(id, workLogId);

      return res.status(200).json({
        success: true,
        message: 'Staff work entry deleted successfully',
        data: deleted,
        error: {}
      });
    } catch (error) {
      logger.error('Delete staff work log error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete staff work entry',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get staff work summary
   * GET /api/staff/:id/summary
   */
  static async getWorkSummary(req, res) {
    try {
      const { id } = req.params;
      const { start_date, end_date } = req.query;
      const shop = await AuthorizationService.getUserShop(req.user.id);
      const staff = await StaffModel.getStaffById(id);

      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      if (staff.shop_id !== shop.id) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Staff member does not belong to your shop',
          error: { code: 'UNAUTHORIZED', details: {} }
        });
      }

      const summary = await StaffModel.getWorkSummary(id, { start_date, end_date });

      return res.status(200).json({
        success: true,
        message: 'Staff work summary retrieved successfully',
        data: summary,
        error: {}
      });
    } catch (error) {
      logger.error('Get staff work summary error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve staff work summary',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }
}

module.exports = StaffController;
