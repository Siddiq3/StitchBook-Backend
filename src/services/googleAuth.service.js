const axios = require('axios');
const logger = require('../utils/logger');

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

const getAllowedClientIds = () => [
  process.env.GOOGLE_WEB_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
].filter(Boolean);

class GoogleAuthService {
  static async verifyIdToken(idToken) {
    if (!idToken) {
      throw new Error('Google ID token is required');
    }

    const { data } = await axios.get(GOOGLE_TOKENINFO_URL, {
      params: { id_token: idToken },
      timeout: 10000,
    });

    if (!data || !data.sub || !data.email) {
      throw new Error('Invalid Google token payload');
    }

    const allowedClientIds = getAllowedClientIds();
    if (allowedClientIds.length > 0 && !allowedClientIds.includes(data.aud)) {
      logger.warn(`Google token audience mismatch: ${data.aud}`);
      throw new Error('Google token was not issued for this app');
    }

    if (data.email_verified && data.email_verified !== 'true' && data.email_verified !== true) {
      throw new Error('Google email is not verified');
    }

    return {
      googleId: data.sub,
      email: data.email.toLowerCase(),
      name: data.name || data.given_name || data.email.split('@')[0],
      avatar: data.picture || null,
    };
  }
}

module.exports = GoogleAuthService;
