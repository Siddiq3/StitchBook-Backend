/**
 * Request logging middleware
 * Uses Morgan for combined request logs and forwards output to logger.
 */

const morgan = require('morgan');
const logger = require('../utils/logger');

morgan.token('safe-path', (req) => req.path.replace(/(upgrade-session|checkout-session)\/[^/]+/g, '$1/[Redacted]'));
morgan.token('id', (req) => req.requestId || 'unknown');
morgan.token('user', (req) => (req.user ? req.user.userId : 'anonymous'));

const stream = {
  write: (message) => logger.info(message.trim()),
};

// Platform health probes run every few seconds; logging them only adds log volume
const skip = (req) => process.env.NODE_ENV === 'test' || ['/health', '/live', '/ready'].includes(req.path);

module.exports = morgan(
  ':id :remote-addr :method :safe-path :status :res[content-length] - :response-time ms user=:user',
  { stream, skip }
);
