/**
 * Customer Controller
 * Handles customer-related HTTP requests
 * Security: All operations filtered by authenticated user's shop
 */

const CustomerService = require('../services/customer.service');
const AuthorizationService = require('../services/authorization.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');
const { parsePagination } = require('../utils/pagination');
const Lists = require('../services/pagedLists.service');
const PlanLimits = require('../services/planLimits.service');

/**
 * POST /customer
 * Create a new customer for authenticated user's shop
 * Security: Shop ID derived from user, not from request
 */
exports.createCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, notes, gender, email, date_of_birth, photo_url } = req.body;

    // Validate request (no shop_id from frontend!)
    if (!name || !phone) {
      return responder.error(res, 400, 'Name and phone are required');
    }

    // Get user's shop (automatically)
    const shop = await AuthorizationService.getUserShop(userId);

    const customer = await PlanLimits.create(req.user, shop.id, 'customers', () => CustomerService.createCustomer(shop.id, {
      name,
      phone,
      notes: notes || null,
      gender: gender || 'male',
      email: email || null,
      date_of_birth: date_of_birth || null,
      photo_url: photo_url || null,
    }));

    logger.info(`Customer created for shop: ${shop.id} by user: ${userId}`);
    responder.success(res, 201, 'Customer created', customer);
  } catch (error) {
    if (error.code === 'PLAN_LIMIT_REACHED' || error.code === 'SUBSCRIPTION_REQUIRED') return responder.error(res,402,error.message,{code:error.code,...error.details});
    logger.error('Create customer error:', error.message);
    responder.error(res, 500, error.message);
  }
};

/**
 * GET /customer
 * Get all customers for authenticated user's shop
 * Security: Shop ID derived from user, supports search via query param
 */
exports.getCustomers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { search } = req.query;
    const { page, limit } = parsePagination(req, 20, 100);

    // Get user's shop
    const shop = await AuthorizationService.getUserShop(userId);

    const result = await Lists.customers(req.user, shop.id, {...req.query, page, limit});

    responder.success(res, 200, 'Customers retrieved', result);
  } catch (error) {
    logger.error('Get customers error:', error.message);
    responder.error(res, 500, 'Failed to get customers', error.message);
  }
};

/**
 * GET /customer/:id
 * Get customer by ID with ownership verification
 * Security: Verifies customer belongs to user's shop
 */
exports.getCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: customerId } = req.params;

    // Verify ownership
    const customer = await AuthorizationService.verifyCustomerOwnership(userId, customerId, req.user);
    responder.success(res, 200, 'Customer retrieved', customer);
  } catch (error) {
    logger.error('Get customer error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 404, error.message);
    }
  }
};

/**
 * PUT /customer/:id
 * Update customer with ownership verification
 * Security: Verifies customer belongs to user's shop
 */
exports.updateCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: customerId } = req.params;
    const updateData = req.body;

    // Verify ownership
    await AuthorizationService.verifyCustomerOwnership(userId, customerId, req.user);

    const customer = await CustomerService.updateCustomer(customerId, updateData);
    responder.success(res, 200, 'Customer updated', customer);
  } catch (error) {
    logger.error('Update customer error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 500, 'Failed to update customer', error.message);
    }
  }
};

/**
 * DELETE /customer/:id
 * Delete customer with ownership verification
 * Security: Verifies customer belongs to user's shop
 */
exports.deleteCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: customerId } = req.params;

    // Verify ownership
    await AuthorizationService.verifyCustomerOwnership(userId, customerId, req.user);

    await CustomerService.deleteCustomer(customerId);
    responder.success(res, 200, 'Customer deleted');
  } catch (error) {
    logger.error('Delete customer error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 500, 'Failed to delete customer', error.message);
    }
  }
};

