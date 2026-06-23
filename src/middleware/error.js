/**
 * Global Error Handling Middleware
 */

const responder = require('../utils/responder');
const logger = require('../utils/logger');

/**
 * Global error handler middleware
 * Must be defined last in middleware chain
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Global error handler:', err.message);

  // Default error status and message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message || 'Validation Error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not Found';
  } else if (err.message && err.message.startsWith('CORS policy')) {
    statusCode = 403;
    message = err.message;
  } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
    statusCode = 503;
    message = 'Request timed out. Please try again.';
  }

  // Hide internal details in production
  const isProd = process.env.NODE_ENV === 'production';
  const safeMessage = isProd && statusCode === 500 ? 'Internal Server Error' : message;
  const errorDetails = isProd ? null : err;

  responder.error(res, statusCode, safeMessage, errorDetails);
};

/**
 * 404 Not Found handler
 * Place this middleware before error handler
 */
const notFoundHandler = (req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.path}`);
  responder.error(res, 404, 'Route not found');
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
