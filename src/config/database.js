/**
 * Database Configuration
 * PostgreSQL connection pool using pg library
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');
require('dotenv').config();

// Create connection pool using DATABASE_URL (Supabase format)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // For development: Disable SSL verification to allow self-signed certificates
  // For production: Use strict SSL verification
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'allow'
  }
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
    logger.info(`Executed query in ${duration}ms`);
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
