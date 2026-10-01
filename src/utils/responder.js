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
  if (process.env.NODE_ENV === "production") {
    if (/invalid input syntax|syntax error|relation .*does not exist|column .*does not exist|ECONN|password authentication|violates .*constraint/i.test(message)) message = "Unable to complete the request";
    if (statusCode >= 500) message = statusCode === 503 ? "Service temporarily unavailable. Please try again." : "Unable to complete the request. Please try again.";
    if (typeof errorDetails !== "object" || errorDetails instanceof Error) errorDetails = null;
    else if (errorDetails) errorDetails = Object.fromEntries(Object.entries(errorDetails).filter(([key]) => ["code", "status", "requiresSubscription", "trialEndDate", "billingPath", "planType", "recommendedPlan"].includes(key)));
  }
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
