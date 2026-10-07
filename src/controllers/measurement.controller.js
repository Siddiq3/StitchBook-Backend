/**
 * Measurement Controller
 * Handles measurement-related HTTP requests
 * Security: All operations validated through customer ownership
 */

const MeasurementService = require('../services/measurement.service');
const AuthorizationService = require('../services/authorization.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');
const { parsePagination } = require('../utils/pagination');

// Accept only real body measurements: up to 80 named fields with numbers in
// (0, 1000]. Labels, record fields, text and absurd values are dropped, so a
// buggy or malicious client cannot store junk.
const MEASUREMENT_RESERVED_KEYS = new Set(['id', 'customer_id', 'customerId', 'shop_id', 'created_at', 'updated_at',
  'createdAt', 'updatedAt', 'outfitType', 'outfit_type', 'outfitLabel', 'outfit_label', 'measurements_data', 'measurementsData']);
const sanitizeMeasurements = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const clean = {};
  for (const [rawKey, rawValue] of Object.entries(data)) {
    const key = String(rawKey).trim().slice(0, 60);
    const value = typeof rawValue === 'number' ? rawValue : Number.parseFloat(rawValue);
    if (!key || MEASUREMENT_RESERVED_KEYS.has(key) || !Number.isFinite(value) || value <= 0 || value > 1000) continue;
    clean[key] = Math.round(value * 100) / 100;
    if (Object.keys(clean).length >= 80) break;
  }
  return clean;
};

/**
 * POST /measurement
 * Create a new measurement record for a customer
 * Security: Verifies customer belongs to user's shop
 * Body: { customer_id, measurements_data: {field1: value1, field2: value2, ...} }
 */
exports.createMeasurement = async (req, res) => {
  try {
    const userId = req.user.id;
    const { customer_id, outfit_type, outfit_label } = req.body;
    const measurements_data = sanitizeMeasurements(req.body.measurements_data);

    // Validate request
    if (!customer_id || Object.keys(measurements_data).length === 0) {
      return responder.error(res, 400, 'Customer ID and at least one measurement are required');
    }

    // Verify customer belongs to user's shop
    await AuthorizationService.verifyCustomerOwnership(userId, customer_id);

    const measurement = await MeasurementService.createMeasurement(
      customer_id,
      measurements_data,
      outfit_type,
      outfit_label
    );

    logger.info(`Measurement created for customer: ${customer_id}`);
    responder.success(res, 201, 'Measurement created', measurement);
  } catch (error) {
    logger.error('Create measurement error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 500, 'Failed to create measurement', error.message);
    }
  }
};

/**
 * GET /measurement/latest
 * Latest measurement for every customer in the caller's shop (one request
 * instead of one per customer). Scoped by the authenticated shop.
 */
exports.getLatestForShop = async (req, res) => {
  try {
    const shopId = req.user.shop_id;
    if (!shopId) return responder.error(res, 404, 'Shop not found');
    const measurements = await MeasurementService.getLatestForShop(shopId);
    responder.success(res, 200, 'Measurements retrieved', { measurements });
  } catch (error) {
    logger.error('Get latest measurements error:', error.message);
    responder.error(res, 500, 'Failed to get measurements');
  }
};

/**
 * GET /measurement/customer/:customerId
 * Get all measurements for a customer
 * Security: Verifies customer belongs to user's shop
 */
exports.getMeasurementsByCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { customerId } = req.params;
    const { outfit_type } = req.query;
    const { page, limit, offset } = parsePagination(req, 20, 100);

    // Verify customer belongs to user's shop
    await AuthorizationService.verifyCustomerOwnership(userId, customerId);

    const measurements = await MeasurementService.getMeasurementsByCustomer(
      customerId,
      outfit_type,
      limit,
      offset
    );

    responder.success(res, 200, 'Measurements retrieved', {
      measurements,
      pagination: { page, limit, offset, hasMore: measurements.length === limit },
    });
  } catch (error) {
    logger.error('Get measurements error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 500, 'Failed to get measurements', error.message);
    }
  }
};

/**
 * GET /measurement/:id
 * Get measurement by ID with ownership verification
 * Security: Verifies measurement belongs to customer's shop
 */
exports.getMeasurement = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: measurementId } = req.params;

    // Verify ownership
    const measurement = await AuthorizationService.verifyMeasurementOwnership(userId, measurementId);
    responder.success(res, 200, 'Measurement retrieved', measurement);
  } catch (error) {
    logger.error('Get measurement error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 404, error.message);
    }
  }
};

/**
 * PUT /measurement/:id
 * Update measurement with ownership verification
 * Security: Verifies measurement belongs to customer's shop
 */
exports.updateMeasurement = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: measurementId } = req.params;
    const measurements_data = sanitizeMeasurements(req.body.measurements_data);

    if (Object.keys(measurements_data).length === 0) {
      return responder.error(res, 400, 'At least one measurement is required');
    }

    // Verify ownership
    await AuthorizationService.verifyMeasurementOwnership(userId, measurementId);

    const measurement = await MeasurementService.updateMeasurement(
      measurementId,
      measurements_data
    );

    responder.success(res, 200, 'Measurement updated', measurement);
  } catch (error) {
    logger.error('Update measurement error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 500, 'Failed to update measurement', error.message);
    }
  }
};

/**
 * DELETE /measurement/:id
 * Delete measurement with ownership verification
 * Security: Verifies measurement belongs to customer's shop
 */
exports.deleteMeasurement = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: measurementId } = req.params;

    // Verify ownership
    await AuthorizationService.verifyMeasurementOwnership(userId, measurementId);

    await MeasurementService.deleteMeasurement(measurementId);
    responder.success(res, 200, 'Measurement deleted');
  } catch (error) {
    logger.error('Delete measurement error:', error.message);
    if (error.message.includes('Unauthorized')) {
      responder.error(res, 403, error.message);
    } else {
      responder.error(res, 500, 'Failed to delete measurement', error.message);
    }
  }
};
