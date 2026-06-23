/**
 * Simple Logger Utility
 */

const util = require('util');

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

const LOG_COLORS = {
  ERROR: '\x1b[31m',   // Red
  WARN: '\x1b[33m',    // Yellow
  INFO: '\x1b[36m',    // Cyan
  DEBUG: '\x1b[35m',   // Magenta
  RESET: '\x1b[0m',    // Reset
};

/**
 * Log message with timestamp and level
 * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
 * @param {string} message - Message to log
 * @param {*} data - Optional data to log
 */
const log = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const color = LOG_COLORS[level] || '';
  const reset = LOG_COLORS.RESET;
  
  const logMessage = `${color}[${timestamp}] ${level}: ${message}${reset}`;
  const details = data ? ` ${util.inspect(data, { depth: 4, breakLength: 120 })}` : '';
  const line = `${logMessage}${details}\n`;
  const stream = level === LOG_LEVELS.ERROR ? process.stderr : process.stdout;

  stream.write(line);
};

const logger = {
  error: (message, data) => log(LOG_LEVELS.ERROR, message, data),
  warn: (message, data) => log(LOG_LEVELS.WARN, message, data),
  info: (message, data) => log(LOG_LEVELS.INFO, message, data),
  debug: (message, data) => log(LOG_LEVELS.DEBUG, message, data),
};

module.exports = logger;
