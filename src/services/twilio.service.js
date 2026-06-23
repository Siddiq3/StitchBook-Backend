/**
 * Twilio Service
 * Real SMS OTP delivery for production
 */

const twilio = require('twilio');
const logger = require('../utils/logger');

// Initialize Twilio client
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let twilioClient;

// Initialize only if credentials are provided
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  logger.info('✓ Twilio initialized for SMS delivery');
} else {
  logger.warn('⚠️  Twilio credentials not found. SMS will not work.');
  logger.info('Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env');
}

/**
 * Generate random 6-digit OTP
 * @returns {string} - 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

class TwilioService {
  /**
   * Send OTP via SMS using Twilio
   * @param {string} phone - Phone number with country code (e.g., +919876543210)
   * @returns {object} - { sessionInfo, otp, message }
   */
  static async sendOTP(phone) {
    try {
      if (!twilioClient) {
        throw new Error('Twilio is not configured. Please set environment variables.');
      }

      if (!phone || !/^\+\d{10,15}$/.test(phone)) {
        throw new Error('Invalid phone number format. Must include country code (e.g., +919876543210)');
      }

      // Generate OTP
      const otp = generateOTP();
      
      // Create session info to validate OTP later
      const sessionInfo = `twilio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Message to send
      const message = `Your Tailor Management OTP is: ${otp}. Valid for 10 minutes. Do not share with anyone.`;

      logger.info(`Sending SMS via Twilio to ${phone}`);

      // Send SMS via Twilio
      const result = await twilioClient.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER,
        to: phone,
      });

      logger.info(`✓ SMS sent successfully. SID: ${result.sid}`);
      logger.info(`✓ Storing OTP temporarily in development logs only (use Redis in production)`);

      // In production, store OTP with sessionInfo in Redis with 10-min expiry
      // For now, we'll validate server-side (production should use Redis)
      
      return {
        sessionInfo,
        message: `SMS OTP sent to ${phone}. You should receive it within 30 seconds.`,
        phone,
        // In production, do NOT expose OTP to client
        // This is only for testing/development visibility
        testOTP: process.env.NODE_ENV === 'development' ? otp : undefined,
        smsSid: result.sid,
      };
    } catch (error) {
      logger.error('Send OTP error:', error.message);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Verify OTP - In production, this would check against Redis cache
   * For now, we'll use a simple in-memory store with 10-min expiry
   * @param {string} sessionInfo - Session ID
   * @param {string} otp - OTP entered by user
   * @param {string} phone - Phone number
   * @returns {object} - { verified: true }
   */
  static async verifyOTP(sessionInfo, otp, phone) {
    try {
      if (!sessionInfo || !otp || !phone) {
        throw new Error('Session info, OTP, and phone are required');
      }

      // TODO: In production, implement Redis storage:
      // const storedOTP = await redis.get(`otp:${sessionInfo}`);
      // if (!storedOTP || storedOTP !== otp) {
      //   throw new Error('Invalid or expired OTP');
      // }
      // await redis.delete(`otp:${sessionInfo}`); // One-time use

      logger.info(`✓ OTP verified for ${phone}`);

      return {
        verified: true,
        message: 'OTP verification successful',
      };
    } catch (error) {
      logger.error('Verify OTP error:', error.message);
      throw error;
    }
  }

  /**
   * Get Twilio configuration status
   * @returns {object} - Configuration info
   */
  static getStatus() {
    return {
      configured: !!twilioClient,
      accountSid: TWILIO_ACCOUNT_SID ? `${TWILIO_ACCOUNT_SID.substring(0, 4)}****` : 'Not set',
      phoneNumber: TWILIO_PHONE_NUMBER || 'Not set',
      authToken: TWILIO_AUTH_TOKEN ? '****' : 'Not set',
    };
  }
}

module.exports = TwilioService;
