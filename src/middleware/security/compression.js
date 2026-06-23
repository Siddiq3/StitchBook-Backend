/**
 * Compression middleware configuration
 * Enables gzip/deflate compression for API responses.
 */

const compression = require('compression');

module.exports = compression({
  threshold: 1024,
});
