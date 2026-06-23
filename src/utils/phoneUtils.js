/**
 * Phone Number Utilities
 * Handles phone number normalization to E.164 format
 * Ensures consistent phone number formatting across the system
 *
 * E.164 format: +[country code][area code][phone number]
 * Example: +919876543210 (India)
 */

const logger = require('./logger');

/**
 * Phone number patterns for different regions
 * Can be extended for more countries
 */
const PHONE_PATTERNS = {
  IN: {
    country_code: '91',
    pattern: /^(?:\+91|0)?([6-9]\d{9})$/, // India
    min_length: 10,
    max_length: 13,
  },
};

/**
 * Normalize phone number to E.164 format
 * Removes all non-digit characters, adds country code if missing
 *
 * @param {string} phone - Raw phone number (any format)
 * @returns {string} - Normalized phone number in E.164 format (+91XXXXXXXXXX)
 * @throws {Error} - If phone number is invalid
 */
const normalizePhone = (phone) => {
  try {
    if (!phone) {
      throw new Error('Phone number is required');
    }

    // Remove all non-digit characters except leading +
    let cleanPhone = phone.toString().trim();
    if (cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone.replace(/\D/g, '');
    } else {
      cleanPhone = cleanPhone.replace(/\D/g, '');
    }

    // If already in E.164 format, return as is
    if (cleanPhone.startsWith('+')) {
      const phoneWithoutPlus = cleanPhone.slice(1);
      if (phoneWithoutPlus.length >= 10) {
        return cleanPhone;
      }
    }

    // If no country code, add India (+91) as default
    // This can be changed to auto-detect or configurable
    if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
      // Assume India for 10-digit numbers
      cleanPhone = '+91' + cleanPhone;
    } else if (!cleanPhone.startsWith('+')) {
      // If already has country code (91 at start for 12 digits)
      if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
        cleanPhone = '+' + cleanPhone;
      } else {
        throw new Error(`Invalid phone number format: ${phone}`);
      }
    }

    // Validate final format
    if (!/^\+\d{10,15}$/.test(cleanPhone)) {
      throw new Error(`Invalid phone number format: ${phone}`);
    }

    logger.info(`✓ Phone normalized: ${phone} → ${cleanPhone}`);
    return cleanPhone;
  } catch (error) {
    logger.error('Phone normalization error:', error.message);
    throw error;
  }
};

/**
 * Validate phone number format
 * Checks if phone is in valid E.164 format
 *
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid
 */
const isValidPhone = (phone) => {
  try {
    if (!phone) return false;

    const cleaned = normalizePhone(phone);
    return /^\+\d{10,15}$/.test(cleaned);
  } catch {
    return false;
  }
};

/**
 * Extract country code from phone number
 * @param {string} phone - Phone number in E.164 format
 * @returns {string} - Country code (e.g., "91" for India)
 */
const getCountryCode = (phone) => {
  try {
    const normalized = normalizePhone(phone);
    // Remove '+' and get first 1-3 digits as country code
    const countryCode = normalized.slice(1, 4);
    return countryCode;
  } catch {
    return null;
  }
};

/**
 * Extract local number (without country code)
 * @param {string} phone - Phone number in E.164 format
 * @returns {string} - Local number
 */
const getLocalNumber = (phone) => {
  try {
    const normalized = normalizePhone(phone);
    // Remove '+' and country code (first 3 chars for most)
    return normalized.slice(3);
  } catch {
    return null;
  }
};

/**
 * Format phone number for display
 * Converts E.164 to user-friendly format
 *
 * @param {string} phone - Phone in E.164 format
 * @returns {string} - Formatted phone (e.g., "+91 98765 43210")
 */
const formatPhoneForDisplay = (phone) => {
  try {
    const normalized = normalizePhone(phone);
    const countryCode = normalized.slice(1, 3);
    const areaCode = normalized.slice(3, 5);
    const localNumber = normalized.slice(5);

    return `+${countryCode} ${areaCode}${localNumber.slice(0, 4)} ${localNumber.slice(4)}`;
  } catch {
    return phone;
  }
};

/**
 * Check if two phone numbers are the same
 * Compares normalized versions
 *
 * @param {string} phone1 - First phone number
 * @param {string} phone2 - Second phone number
 * @returns {boolean} - True if same
 */
const phoneEquals = (phone1, phone2) => {
  try {
    const normalized1 = normalizePhone(phone1);
    const normalized2 = normalizePhone(phone2);
    return normalized1 === normalized2;
  } catch {
    return false;
  }
};

module.exports = {
  normalizePhone,
  isValidPhone,
  getCountryCode,
  getLocalNumber,
  formatPhoneForDisplay,
  phoneEquals,
};
