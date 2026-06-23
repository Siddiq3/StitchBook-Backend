/**
 * Helmet security middleware configuration
 * Provides HTTP header protections for production APIs.
 */

const helmet = require('helmet');

module.exports = helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});
