/**
 * Measurement Controller
 * Handles measurement-related HTTP requests
 * Security: All operations validated through customer ownership
 */

const MeasurementService = require('../services/measurement.service');
const AuthorizationService = require('../services/authorization.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

/**
 * POST /measurement
 * Create a new measurement record for a customer
 * Security: Verifies customer belongs to user's shop
 * Body: { customer_id, measurements_data: {field1: value1, field2: value2, ...} }
 */
exports.createMeasurement = async (req, res) => {
  try {
    const userId = req.user.id;
    const { customer_id, measurements_data, outfit_type, outfit_label } = req.body;

    // Validate request
    if (!customer_id || !measurements_data) {
      return responder.error(res, 400, 'Customer ID and measurements data are required');
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
 * GET /measurement/customer/:customerId
 * Get all measurements for a customer
 * Security: Verifies customer belongs to user's shop
 */
exports.getMeasurementsByCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { customerId } = req.params;
    const { outfit_type } = req.query;

    // Verify customer belongs to user's shop
    await AuthorizationService.verifyCustomerOwnership(userId, customerId);

    const measurements = await MeasurementService.getMeasurementsByCustomer(
      customerId,
      outfit_type
    );

    responder.success(res, 200, 'Measurements retrieved', { measurements });
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
    const { measurements_data } = req.body;

    if (!measurements_data) {
      return responder.error(res, 400, 'Measurements data is required');
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
