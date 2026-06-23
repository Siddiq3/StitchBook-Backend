/**
 * Measurement Service
 * Handles measurement-related business logic
 */

const MeasurementModel = require('../models/measurement.model');
const logger = require('../utils/logger');

class MeasurementService {
  /**
   * Create a new measurement record
   * @param {number} customerId - Customer ID
   * @param {object} measurementsData - Dynamic measurement fields
   * @param {string} outfitType - Type of outfit (optional)
   * @param {string} outfitLabel - Label for the outfit (optional)
   * @returns {object} - Created measurement
   */
  static async createMeasurement(customerId, measurementsData, outfitType = null, outfitLabel = null) {
    try {
      if (!measurementsData || Object.keys(measurementsData).length === 0) {
        throw new Error('Measurements data is required');
      }

      const measurement = await MeasurementModel.createMeasurement({
        customer_id: customerId,
        measurements_data: measurementsData,
        outfit_type: outfitType,
        outfit_label: outfitLabel,
      });

      logger.info(`Measurement created for customer: ${customerId}`);
      return {
        ...measurement,
        outfitType: measurement.outfit_type,
        outfitLabel: measurement.outfit_label,
        measurementsData: measurement.measurements_data,
        createdAt: measurement.created_at,
        updatedAt: measurement.updated_at,
      };
    } catch (error) {
      logger.error('Error creating measurement:', error.message);
      throw error;
    }
  }

  /**
   * Get latest measurement for a customer
   * @param {number} customerId - Customer ID
   * @returns {object} - Latest measurement record
   */
  static async getLatestMeasurement(customerId) {
    try {
      const measurement = await MeasurementModel.getLatestMeasurement(customerId);
      
      if (!measurement) {
        throw new Error('No measurements found for this customer');
      }

      return {
        ...measurement,
        outfitType: measurement.outfit_type,
        outfitLabel: measurement.outfit_label,
        measurementsData: measurement.measurements_data,
        createdAt: measurement.created_at,
        updatedAt: measurement.updated_at,
      };
    } catch (error) {
      logger.error('Error getting latest measurement:', error.message);
      throw error;
    }
  }

  /**
   * Get all measurements for a customer
   * @param {number} customerId - Customer ID
   * @returns {array} - Array of measurements
   */
  static async getMeasurementsByCustomer(customerId, outfitType = null) {
    try {
      const measurements = await MeasurementModel.getMeasurementsByCustomer(customerId, outfitType);
      
      logger.info(`Retrieved measurements for customer: ${customerId}`);
      return measurements.map((measurement) => ({
        ...measurement,
        outfitType: measurement.outfit_type,
        outfitLabel: measurement.outfit_label,
        measurementsData: measurement.measurements_data,
        createdAt: measurement.created_at,
        updatedAt: measurement.updated_at,
      }));
    } catch (error) {
      logger.error('Error getting measurements:', error.message);
      throw error;
    }
  }

  /**
   * Get measurement by ID
   * @param {number} measurementId - Measurement ID
   * @returns {object} - Measurement data
   */
  static async getMeasurement(measurementId) {
    try {
      const measurement = await MeasurementModel.getMeasurementById(measurementId);
      
      if (!measurement) {
        throw new Error('Measurement not found');
      }

      return {
        ...measurement,
        outfitType: measurement.outfit_type,
        outfitLabel: measurement.outfit_label,
        measurementsData: measurement.measurements_data,
        createdAt: measurement.created_at,
        updatedAt: measurement.updated_at,
      };
    } catch (error) {
      logger.error('Error getting measurement:', error.message);
      throw error;
    }
  }

  /**
   * Update measurement
   * @param {number} measurementId - Measurement ID
   * @param {object} measurementsData - Updated measurements data
   * @returns {object} - Updated measurement
   */
  static async updateMeasurement(measurementId, measurementsData) {
    try {
      if (!measurementsData || Object.keys(measurementsData).length === 0) {
        throw new Error('Measurements data is required');
      }

      const measurement = await MeasurementModel.updateMeasurement(measurementId, {
        measurements_data: measurementsData,
      });
      
      if (!measurement) {
        throw new Error('Failed to update measurement');
      }

      logger.info(`Updated measurement: ${measurementId}`);
      return measurement;
    } catch (error) {
      logger.error('Error updating measurement:', error.message);
      throw error;
    }
  }

  /**
   * Delete measurement
   * @param {number} measurementId - Measurement ID
   * @returns {boolean} - Success status
   */
  static async deleteMeasurement(measurementId) {
    try {
      const result = await MeasurementModel.deleteMeasurement(measurementId);
      
      if (!result) {
        throw new Error('Failed to delete measurement');
      }

      logger.info(`Deleted measurement: ${measurementId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting measurement:', error.message);
      throw error;
    }
  }
}

module.exports = MeasurementService;
