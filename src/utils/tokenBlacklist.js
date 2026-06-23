/**
 * Token Blacklist Manager
 * Simple in-memory blacklist for logged-out tokens
 * For production: use Redis for persistence across server restarts
 */

class TokenBlacklist {
  constructor() {
    this.blacklist = new Set();
  }

  /**
   * Add token to blacklist (when user logs out)
   * @param {string} token - JWT token to blacklist
   * @returns {void}
   */
  add(token) {
    this.blacklist.add(token);
  }

  /**
   * Check if token is blacklisted
   * @param {string} token - JWT token
   * @returns {boolean} - true if blacklisted, false otherwise
   */
  has(token) {
    return this.blacklist.has(token);
  }

  /**
   * Clear blacklist (useful for debugging/testing)
   * @returns {void}
   */
  clear() {
    this.blacklist.clear();
  }

  /**
   * Get blacklist size
   * @returns {number} - Number of blacklisted tokens
   */
  size() {
    return this.blacklist.size;
  }
}

module.exports = new TokenBlacklist();
