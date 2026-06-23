/**
 * Standard API Response Builder
 */

/**
 * Send success response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Response message
 * @param {*} data - Response data
 */
const success = (res, statusCode = 200, message = 'Success', data = null) => {
  const response = {
    success: true,
    message,
    data,
  };
  res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {*} error - Error details (optional)
 */
const error = (res, statusCode = 500, message = 'Error', errorDetails = null) => {
  const response = {
    success: false,
    message,
    error: errorDetails,
  };
  res.status(statusCode).json(response);
};

module.exports = {
  success,
  error,
};
