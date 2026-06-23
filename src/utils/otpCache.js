/**
 * OTP Storage Cache
 * Stores OTPs temporarily during verification window (10 minutes)
 * 
 * For development: In-memory map
 * For production: Use Redis instead (recommended)
 */

const logger = require('../utils/logger');

class OTPCache {
  constructor() {
    this.cache = new Map(); // In-memory storage
    this.OTP_EXPIRY = 10 * 60 * 1000; // 10 minutes
    this.cleanup();
  }

  /**
   * Store OTP with expiry
   * @param {string} sessionInfo - Session ID
   * @param {string} otp - OTP code
   * @param {string} phone - Phone number
   */
  store(sessionInfo, otp, phone) {
    const expiryTime = Date.now() + this.OTP_EXPIRY;
    this.cache.set(sessionInfo, {
      otp,
      phone,
      expiryTime,
      attempts: 0,
      maxAttempts: 5,
    });

    logger.info(`OTP stored for session: ${sessionInfo.substring(0, 20)}...`);
  }

  /**
   * Retrieve and verify OTP
   * @param {string} sessionInfo - Session ID
   * @param {string} otp - OTP code entered by user
   * @returns {object} - { valid: true/false, message, phone }
   */
  verify(sessionInfo, otp) {
    const data = this.cache.get(sessionInfo);

    if (!data) {
      return { valid: false, message: 'Session not found or expired' };
    }

    // Check expiry
    if (Date.now() > data.expiryTime) {
      this.cache.delete(sessionInfo);
      return { valid: false, message: 'OTP expired. Request a new one.' };
    }

    // Check max attempts
    if (data.attempts >= data.maxAttempts) {
      this.cache.delete(sessionInfo);
      return { valid: false, message: 'Too many attempts. Request a new OTP.' };
    }

    // Check OTP
    data.attempts++;

    if (data.otp !== otp) {
      this.cache.set(sessionInfo, data); // Update attempts
      return { 
        valid: false, 
        message: `Invalid OTP. ${data.maxAttempts - data.attempts} attempts remaining.`,
        attemptsRemaining: data.maxAttempts - data.attempts,
      };
    }

    // OTP is correct
    const phone = data.phone;
    this.cache.delete(sessionInfo); // One-time use
    logger.info(`✓ OTP verified for ${phone}`);

    return { 
      valid: true, 
      message: 'OTP verified successfully',
      phone,
    };
  }

  /**
   * Periodic cleanup of expired OTPs
   * Runs every 5 minutes
   */
  cleanup() {
    setInterval(() => {
      const now = Date.now();
      let expired = 0;

      for (const [sessionId, data] of this.cache.entries()) {
        if (now > data.expiryTime) {
          this.cache.delete(sessionId);
          expired++;
        }
      }

      if (expired > 0) {
        logger.info(`Cleaned up ${expired} expired OTP sessions`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Get cache statistics
   * @returns {object}
   */
  getStats() {
    return {
      activeOTPs: this.cache.size,
      expiryWindow: `${this.OTP_EXPIRY / 60000} minutes`,
    };
  }

  /**
   * Clear all cache (for testing)
   */
  clear() {
    this.cache.clear();
    logger.warn('OTP cache cleared');
  }
}

module.exports = new OTPCache();
