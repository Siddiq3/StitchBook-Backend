/**
 * Request ID middleware
 * Assigns a unique ID to every request for tracing/logging.
 */

const { v4: uuidv4 } = require('uuid');

module.exports = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};
