/**
 * Customer Service
 * Handles customer-related business logic
 */

const CustomerModel = require('../models/customer.model');
const logger = require('../utils/logger');

class CustomerService {
  /**
   * Create a new customer
   * @param {number} shopId - Shop ID
   * @param {object} customerData - Customer data {name, phone, notes}
   * @returns {object} - Created customer
   */
  static async createCustomer(shopId, customerData) {
    try {
      const customer = await CustomerModel.createCustomer({
        shop_id: shopId,
        ...customerData,
      });

      logger.info(`Customer created for shop: ${shopId}`);
      return customer;
    } catch (error) {
      logger.error('Error creating customer:', error.message);
      throw error;
    }
  }

  /**
   * Get customer by ID
   * @param {number} customerId - Customer ID
   * @returns {object} - Customer data
   */
  static async getCustomer(customerId) {
    try {
      const customer = await CustomerModel.getCustomerById(customerId);
      
      if (!customer) {
        throw new Error('Customer not found');
      }

      return customer;
    } catch (error) {
      logger.error('Error getting customer:', error.message);
      throw error;
    }
  }

  /**
   * Get all customers for a shop
   * @param {number} shopId - Shop ID
   * @param {number} page - Page number (default 1)
   * @param {number} limit - Records per page (default 20)
   * @returns {object} - Customers and pagination info
   */
  static async getCustomersByShop(shopId, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      const customers = await CustomerModel.getCustomersByShop(shopId, limit, offset);
      const total = await CustomerModel.getCustomerCount(shopId);

      logger.info(`Retrieved customers for shop: ${shopId}`);

      return {
        customers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting customers:', error.message);
      throw error;
    }
  }

  /**
   * Search customers by name or phone
   * @param {number} shopId - Shop ID
   * @param {string} searchTerm - Search term
   * @returns {array} - Matching customers
   */
  static async searchCustomers(shopId, searchTerm) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        throw new Error('Search term is required');
      }

      const customers = await CustomerModel.searchCustomers(shopId, searchTerm);
      logger.info(`Searched customers for shop: ${shopId} with term: ${searchTerm}`);
      return customers;
    } catch (error) {
      logger.error('Error searching customers:', error.message);
      throw error;
    }
  }

  /**
   * Update customer
   * @param {number} customerId - Customer ID
   * @param {object} updateData - Data to update
   * @returns {object} - Updated customer
   */
  static async updateCustomer(customerId, updateData) {
    try {
      const customer = await CustomerModel.updateCustomer(customerId, updateData);
      
      if (!customer) {
        throw new Error('Failed to update customer');
      }

      logger.info(`Updated customer: ${customerId}`);
      return customer;
    } catch (error) {
      logger.error('Error updating customer:', error.message);
      throw error;
    }
  }

  /**
   * Delete customer
   * @param {number} customerId - Customer ID
   * @returns {boolean} - Success status
   */
  static async deleteCustomer(customerId) {
    try {
      const result = await CustomerModel.deleteCustomer(customerId);
      
      if (!result) {
        throw new Error('Failed to delete customer');
      }

      logger.info(`Deleted customer: ${customerId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting customer:', error.message);
      throw error;
    }
  }
}

module.exports = CustomerService;
