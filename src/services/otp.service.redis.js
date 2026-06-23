/**
 * OTP Service (Redis-backed)
 * Multi-provider OTP handling:
 * - Development: Test phone numbers (no SMS)
 * - Production: Real SMS via Twilio
 */

const { v4: uuidv4 } = require('uuid');
const { client: redis, keyPrefix, isReady: isRedisReady } = require('../config/redis');
const logger = require('../utils/logger');
const TwilioService = require('./twilio.service');

const ensureRedis = () => {
  if (!isRedisReady()) {
    throw new Error('Redis is unavailable');
  }
};

const OTP_PREFIX = `${keyPrefix}otp:`;
const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
const MAX_ATTEMPTS = 5;

const getOtpKey = (sessionId) => `${OTP_PREFIX}${sessionId}`;

class OTPService {
  static TEST_PHONE_NUMBERS = {
    '+919876543210': '123456',
    '+919705116606': '123456',
    '+918888888888': '123456',
    '+919999999999': '654321',
  };

  static isTestPhone(phone) {
    return Object.keys(this.TEST_PHONE_NUMBERS).includes(phone);
  }

  static getTestOTP(phone) {
    return this.TEST_PHONE_NUMBERS[phone] || '123456';
  }

  static async sendOTP(phone) {
    try {
      if (!phone) {
        throw new Error('Phone number is required');
      }

      const sessionId = uuidv4();

      // Development mode: Use test phone numbers
      if (process.env.NODE_ENV === 'development' && this.isTestPhone(phone)) {
        logger.info(`✓ Test phone detected: ${phone}`);
        const testOtp = this.getTestOTP(phone);
        logger.info(`ℹ️  Test OTP for this session: ${testOtp}`);

        ensureRedis();
        ensureRedis();
        await redis.hmset(getOtpKey(sessionId), {
          otp: testOtp,
          phone,
          attempts: '0',
          createdAt: String(Date.now()),
        });
        await redis.expire(getOtpKey(sessionId), OTP_TTL_SECONDS);

        return {
          sessionId,
          message: `[TEST MODE] OTP sent to ${phone}. Use OTP: ${testOtp}`,
          provider: 'test',
          testOTP: testOtp,
          phone,
        };
      }

      // Production or real number: Use Twilio for real SMS
      logger.info(`Sending real SMS via Twilio to ${phone}...`);

      try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const twilioResult = await TwilioService.sendOTP(phone, otp);

        ensureRedis();
        await redis.hmset(getOtpKey(sessionId), {
          otp,
          phone,
          attempts: '0',
          createdAt: String(Date.now()),
        });
        await redis.expire(getOtpKey(sessionId), OTP_TTL_SECONDS);

        logger.info(`✓ OTP sent via Twilio to ${phone}`);

        return {
          sessionId,
          ...twilioResult,
          provider: 'twilio',
        };
      } catch (twilioError) {
        logger.error('Twilio error:', twilioError.message);

        // Fallback to test mode if Twilio fails
        if (process.env.NODE_ENV === 'development') {
          logger.warn('Twilio unavailable. Falling back to test mode.');
          const testOtp = '123456';

          ensureRedis();
          await redis.hmset(getOtpKey(sessionId), {
            otp: testOtp,
            phone,
            attempts: '0',
            createdAt: String(Date.now()),
          });
          await redis.expire(getOtpKey(sessionId), OTP_TTL_SECONDS);

          return {
            sessionId,
            message: `[FALLBACK MODE] Test OTP: ${testOtp}. Configure Twilio in .env for real SMS.`,
            provider: 'test-fallback',
            testOTP: testOtp,
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

  static async verifyOTP(sessionId, otp, phone) {
    try {
      ensureRedis();
      const key = getOtpKey(sessionId);
      const otpData = await redis.hgetall(key);

      if (!otpData || Object.keys(otpData).length === 0) {
        return { valid: false, message: 'Session not found or expired' };
      }

      const attempts = Number(otpData.attempts) || 0;

      if (attempts >= MAX_ATTEMPTS) {
        await redis.del(key);
        return { valid: false, message: 'Too many attempts. Request a new OTP.' };
      }

      if (otpData.otp !== otp) {
        const newAttempts = attempts + 1;
        await redis.hset(key, 'attempts', String(newAttempts));
        await redis.expire(key, OTP_TTL_SECONDS);

        return {
          valid: false,
          message: `Invalid OTP. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`,
          attemptsRemaining: MAX_ATTEMPTS - newAttempts,
        };
      }

      // OTP is correct
      await redis.del(key);
      logger.info(`✓ OTP verified for ${phone}`);

      return {
        valid: true,
        message: 'OTP verified successfully',
        phone: otpData.phone,
      };
    } catch (error) {
      logger.error('Verify OTP error:', error.message);
      throw error;
    }
  }

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
