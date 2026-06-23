/**
 * Firebase Service
 * Handles Firebase Admin SDK operations for token verification
 * Validates OTP tokens and extracts user information
 *
 * Firebase handles OTP generation and verification on the frontend.
 * Backend only validates the returned ID token.
 */

const admin = require('firebase-admin');
const logger = require('../utils/logger');
const phoneUtils = require('../utils/phoneUtils');

/**
 * Initialize Firebase Admin SDK
 * Requires FIREBASE_SERVICE_ACCOUNT environment variable
 */
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) {
    return;
  }

  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      firebaseInitialized = true;
      logger.info('✓ Firebase Admin SDK already initialized');
      return;
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    // Check if Firebase is configured
    if (!serviceAccountJson) {
      logger.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not configured. Using test mode.');
      firebaseInitialized = true;
      return;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    logger.info('✓ Firebase Admin SDK initialized');
    firebaseInitialized = true;
  } catch (error) {
    logger.error('Firebase initialization error:', error.message);
    firebaseInitialized = true; // Mark as initialized to avoid repeated attempts
  }
};

/**
 * Verify Firebase ID Token
 * @param {string} idToken - Firebase ID Token from frontend
 * @returns {object} - Decoded token with user info
 * @throws {Error} - If token is invalid
 */
const verifyIdToken = async (idToken) => {
  try {
    if (!idToken) {
      throw new Error('ID token is required');
    }

    // Initialize Firebase if not done
    initializeFirebase();

    // Check if Firebase Auth is available
    if (!admin.apps.length) {
      throw new Error('Firebase is not initialized');
    }

    // Verify token using Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    logger.info(`✓ Firebase token verified for user: ${decodedToken.uid}`);

    return decodedToken;
  } catch (error) {
    logger.error('Firebase token verification error:', error.message);
    throw new Error(`Invalid Firebase token: ${error.message}`);
  }
};

/**
 * Extract phone number from Firebase token
 * @param {object} decodedToken - Decoded Firebase token
 * @returns {string} - Normalized phone number in E.164 format
 * @throws {Error} - If phone number not found
 */
const extractPhoneFromToken = (decodedToken) => {
  // Firebase OTP tokens contain phone_number in the decoded JWT
  const phone = decodedToken.phone_number;

  if (!phone) {
    throw new Error('Phone number not found in Firebase token. Ensure OTP verification is completed on frontend.');
  }

  // Normalize phone to E.164 format
  const normalizedPhone = phoneUtils.normalizePhone(phone);

  return normalizedPhone;
};

/**
 * Extract user info from Firebase token
 * @param {object} decodedToken - Decoded Firebase token
 * @returns {object} - User info { phone, firebaseUid, name }
 */
const extractUserInfoFromToken = (decodedToken) => {
  const phone = extractPhoneFromToken(decodedToken);

  return {
    phone,
    firebaseUid: decodedToken.uid, // Firebase UID for future reference
    name: decodedToken.name || null, // Display name if available
  };
};

/**
 * Verify token and get user info
 * This is the main method to be called from auth.service.js
 * @param {string} idToken - Firebase ID Token
 * @returns {object} - User info extracted from token
 */
const verifyTokenAndGetUserInfo = async (idToken) => {
  try {
    const decodedToken = await verifyIdToken(idToken);
    const userInfo = extractUserInfoFromToken(decodedToken);

    return userInfo;
  } catch (error) {
    logger.error('Error verifying token and extracting user info:', error.message);
    throw error;
  }
};

/**
 * TEST MODE: Verify token in development without Firebase
 * Used when Firebase is not configured or in development
 * @param {string} testToken - Test token (can be any string)
 * @param {string} testPhone - Phone number to use
 * @returns {object} - User info
 */
const verifyTestToken = (testToken, testPhone) => {
  const normalizedPhone = phoneUtils.normalizePhone(testPhone);

  return {
    phone: normalizedPhone,
    firebaseUid: `test_${Date.now()}`,
    name: null,
  };
};

module.exports = {
  initializeFirebase,
  verifyIdToken,
  extractPhoneFromToken,
  extractUserInfoFromToken,
  verifyTokenAndGetUserInfo,
  verifyTestToken,
};
