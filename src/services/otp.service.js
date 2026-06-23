/**
 * OTP Service
 * Multi-provider OTP handling:
 * - Development: Test phone numbers (no SMS)
 * - Production: Real SMS via Twilio
 */

const logger = require('../utils/logger');
const otpCache = require('../utils/otpCache');
const TwilioService = require('./twilio.service');

class OTPService {
  /**
   * Development test phone numbers (configured in Firebase Console)
   * These numbers receive hardcoded OTP codes, no real SMS sent
   */
  static TEST_PHONE_NUMBERS = {
    '+919876543210': '123456',
    '+919705116606': '123456',
    '+918888888888': '123456',
    '+919999999999': '654321',
  };

  /**
   * Check if phone number is a test number
   * @param {string} phone - Phone number
   * @returns {boolean}
   */
  static isTestPhone(phone) {
    return Object.keys(this.TEST_PHONE_NUMBERS).includes(phone);
  }

  /**
   * Get test OTP for phone number
   * @param {string} phone - Phone number
   * @returns {string} - OTP code
   */
  static getTestOTP(phone) {
    return this.TEST_PHONE_NUMBERS[phone] || '123456';
  }

  /**
   * Send OTP - automatically chooses provider based on environment
   * @param {string} phone - Phone number
   * @returns {object} - { sessionInfo, message, provider }
   */
  static async sendOTP(phone) {
    try {
      if (!phone) {
        throw new Error('Phone number is required');
      }

      // Development mode: Use test phone numbers
      if (process.env.NODE_ENV === 'development' && this.isTestPhone(phone)) {
        logger.info(`✓ Test phone detected: ${phone}`);
        logger.info(`ℹ️  Test OTP for this session: ${this.getTestOTP(phone)}`);

        const sessionInfo = `test_session_${Date.now()}_${phone.replace(/[^0-9]/g, '')}`;
        const otp = this.getTestOTP(phone);

        // Store OTP in cache
        otpCache.store(sessionInfo, otp, phone);

        return {
          sessionInfo,
          message: `[TEST MODE] OTP sent to ${phone}. Use OTP: ${otp}`,
          provider: 'test',
          testOTP: otp,
          phone,
        };
      }

      // Production or real number: Use Twilio for real SMS
      logger.info(`Sending real SMS via Twilio to ${phone}...`);
      
      try {
        const result = await TwilioService.sendOTP(phone);
        
        // Generate OTP and store in cache
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpCache.store(result.sessionInfo, otp, phone);

        logger.info(`✓ OTP stored in cache for ${phone}`);

        return {
          ...result,
          provider: 'twilio',
        };
      } catch (twilioError) {
        logger.error('Twilio error:', twilioError.message);
        
        // Fallback to test mode if Twilio fails
        if (process.env.NODE_ENV === 'development') {
          logger.warn('Twilio unavailable. Falling back to test mode.');
          const sessionInfo = `test_fallback_${Date.now()}_${phone.replace(/[^0-9]/g, '')}`;
          const otp = '123456';

          otpCache.store(sessionInfo, otp, phone);

          return {
            sessionInfo,
            message: `[FALLBACK MODE] Test OTP: ${otp}. Configure Twilio in .env for real SMS.`,
            provider: 'test-fallback',
            testOTP: otp,
            phone,
          };
        }

        throw twilioError;
      }
    } catch (error) {
      logger.error('Send OTP error:', error.message);
      throw error;
    }
  }

  /**
   * Verify OTP - checks against stored OTP in cache
   * @param {string} sessionInfo - Session info from sendOTP
   * @param {string} otp - OTP entered by user
   * @param {string} phone - Phone number
   * @returns {object} - { user, token, provider }
   */
  static async verifyOTP(sessionInfo, otp, phone) {
    try {
      // Verify OTP against cache
      const cacheResult = otpCache.verify(sessionInfo, otp);

      if (!cacheResult.valid) {
        throw new Error(cacheResult.message);
      }

      logger.info(`✓ OTP verified successfully for ${phone}`);

      // Authenticate user
      const AuthService = require('./auth.service');
      const firebaseUid = `phone_${phone.replace(/[^0-9]/g, '')}`;
      const result = await AuthService.authenticateUser(phone, firebaseUid);

      return {
        ...result,
        provider: 'verified',
        message: 'OTP verified and user authenticated',
      };
    } catch (error) {
      logger.error('Verify OTP error:', error.message);
      throw error;
    }
  }

  /**
   * Resend OTP
   * @param {string} phone - Phone number
   * @returns {object}
   */
  static async resendOTP(phone) {
    try {
      logger.info(`Resending OTP to ${phone}...`);
      return await this.sendOTP(phone);
    } catch (error) {
      logger.error('Resend OTP error:', error.message);
      throw error;
    }
  }
}

module.exports = OTPService;
