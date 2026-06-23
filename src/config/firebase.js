/**
 * Firebase Admin SDK Configuration
 * Initialize Firebase for OTP and authentication
 */

const admin = require('firebase-admin');
const logger = require('../utils/logger');

// Initialize Firebase Admin SDK
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
      // Admin SDK uses Application Default Credentials (ADC) or service account key
      // For development, ensure you have credentials set via GOOGLE_APPLICATION_CREDENTIALS env var
      // or pass the service account JSON directly
    });
    logger.info('✓ Firebase Admin SDK initialized');
  }
} catch (error) {
  logger.error('Firebase initialization error:', error.message);
  // Don't throw - allow app to run without Firebase for now
}

module.exports = admin;
