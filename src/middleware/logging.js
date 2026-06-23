/**
 * Request logging middleware
 * Uses Morgan for combined request logs and forwards output to logger.
 */

const morgan = require('morgan');
const logger = require('../utils/logger');

morgan.token('id', (req) => req.requestId || 'unknown');
morgan.token('user', (req) => (req.user ? req.user.userId : 'anonymous'));

const stream = {
  write: (message) => logger.info(message.trim()),
};

const skip = () => process.env.NODE_ENV === 'test';

module.exports = morgan(
  ':id :remote-addr :method :url :status :res[content-length] - :response-time ms user=:user',
  { stream, skip }
);
