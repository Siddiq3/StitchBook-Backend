/**
 * Database Configuration
 * PostgreSQL connection pool using pg library
 */

const { Pool, types } = require('pg');

// Return DATE columns (delivery_date, payment_date, ...) as plain 'YYYY-MM-DD'.
// The default converts them to a JS Date at server-local midnight, which can
// shift the calendar day when serialized to UTC.
types.setTypeParser(1082, (value) => value);

const logger = require('../utils/logger');
require('./env');
const { databaseTlsConfig } = require('./databaseTls');

const boundedInt = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const SLOW_QUERY_MS = boundedInt(process.env.SLOW_QUERY_MS, 250, 50, 5000);

const pool = new Pool({
  ...databaseTlsConfig(),
  max: boundedInt(process.env.DB_POOL_MAX, 5, 1, 20),
  idleTimeoutMillis: boundedInt(process.env.DB_POOL_IDLE_TIMEOUT_MS, 30000, 5000, 120000),
  connectionTimeoutMillis: boundedInt(process.env.DB_CONNECT_TIMEOUT_MS, 10000, 1000, 30000),
});

// Test connection
pool.on('connect', () => {
  logger.info('✓ Database connected successfully');
});

pool.on('error', (err) => {
  logger.error('Unexpected connection pool error:', err);
});

/**
 * Execute query with connection pooling
 * @param {string} query - SQL query
 * @param {array} params - Query parameters for parameterized queries
 * @returns {Promise} - Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration >= SLOW_QUERY_MS) {
      logger.warn('Slow database query', { durationMs: duration });
    } else {
      logger.debug('Database query completed', { durationMs: duration });
    }
    return result;
  } catch (error) {
    logger.error('Database query error:', error);
    throw error;
  }
};

/**
 * Get a single row from query result
 * @param {string} query - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise} - First row or null
 */
const queryRow = async (text, params) => {
  const result = await query(text, params);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Get all rows from query result
 * @param {string} query - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise} - Array of rows
 */
const queryAll = async (text, params) => {
  const result = await query(text, params);
  return result.rows;
};

module.exports = {
  pool,
  query,
  queryRow,
  queryAll,
};
