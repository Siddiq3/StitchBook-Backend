/**
 * Request timeout middleware
 * Limits each request to 30 seconds.
 */

const timeout = require('connect-timeout');

module.exports = timeout('30s');
