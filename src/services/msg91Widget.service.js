const axios = require('axios');
const crypto = require('crypto');
const phoneUtils = require('../utils/phoneUtils');
const logger = require('../utils/logger');
const { client: redis, isReady: isRedisReady, keyPrefix: redisPrefix } = require('../config/redis');

const MSG91_VERIFY_URL = 'https://control.msg91.com/api/v5/widget/verifyAccessToken';
const MSG91_WIDGET_BASE_URL = 'https://control.msg91.com/api/v5/widget';
const OTP_SESSION_TTL_SECONDS = 10 * 60;
const memoryOtpSessions = new Map();

const getWidgetConfig = () => {
  const widgetId = process.env.MSG91_WIDGET_ID;
  const tokenAuth = process.env.MSG91_WIDGET_TOKEN_AUTH;

  if (!widgetId || !tokenAuth) {
    throw new Error('MSG91 widget mobile OTP config is missing');
  }

  return { widgetId, tokenAuth };
};

const normalizeMsg91Identifier = (identifier) => {
  const normalized = phoneUtils.normalizePhone(identifier);
  return normalized.replace(/^\+/, '');
};

const sessionKey = (reqId) => `${redisPrefix}msg91:otp:${reqId}`;

const saveOtpSession = async (reqId, identifier) => {
  if (isRedisReady()) {
    await redis.set(sessionKey(reqId), JSON.stringify({identifier,attempts:0}), 'EX', OTP_SESSION_TTL_SECONDS);
    return;
  }

  memoryOtpSessions.set(reqId, {
    identifier,
    attempts: 0,
    expiresAt: Date.now() + OTP_SESSION_TTL_SECONDS * 1000,
  });
};

const getOtpSession = async (reqId) => {
  if (isRedisReady()) {
    return redis.eval(`
      local raw=redis.call('GET',KEYS[1]); if not raw then return nil end
      local value=cjson.decode(raw)
      if value.attempts>=5 then redis.call('DEL',KEYS[1]); return nil end
      value.attempts=value.attempts+1
      local ttl=redis.call('TTL',KEYS[1]); if ttl<1 then return nil end
      redis.call('SET',KEYS[1],cjson.encode(value),'EX',ttl)
      return value.identifier
    `,1,sessionKey(reqId));
  }

  const item = memoryOtpSessions.get(reqId);
  if (!item) return null;
  if (item.expiresAt < Date.now()) {
    memoryOtpSessions.delete(reqId);
    return null;
  }
  item.attempts++;
  if(item.attempts>5){memoryOtpSessions.delete(reqId);return null;}
  return item.identifier;
};

const deleteOtpSession = async (reqId) => {
  if (isRedisReady()) {
    await redis.del(sessionKey(reqId));
    return;
  }

  memoryOtpSessions.delete(reqId);
};

class Msg91WidgetService {
  static async sendMobileOtp(identifier) {
    const { widgetId, tokenAuth } = getWidgetConfig();
    const msg91Identifier = normalizeMsg91Identifier(identifier);
    if(process.env.NODE_ENV==='production'&&!isRedisReady()) throw new Error('Authentication temporarily unavailable');
    const cooldownKey=`${redisPrefix}msg91:cooldown:${crypto.createHash('sha256').update(msg91Identifier).digest('hex')}`;
    if(isRedisReady()&&!await redis.set(cooldownKey,'1','EX',60,'NX')) throw new Error('Please wait before requesting another code');

    logger.info('Sending MSG91 mobile OTP');

    const { data } = await axios.post(
      `${MSG91_WIDGET_BASE_URL}/sendOtpMobile`,
      {
        widgetId,
        tokenAuth,
        identifier: msg91Identifier,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    logger.info('MSG91 mobile OTP request accepted');

    if (!data || data.type !== 'success' || !data.message) {
      throw new Error(data?.message || 'Unable to send OTP');
    }

    await saveOtpSession(data.message, msg91Identifier);

    return {
      reqId: data.message,
      identifier: msg91Identifier,
    };
  }

  static async verifyMobileOtp(reqId, otp) {
    const { widgetId, tokenAuth } = getWidgetConfig();

    if (!reqId || !otp) {
      throw new Error('OTP request id and OTP are required');
    }

    const identifier = await getOtpSession(reqId);
    if (!identifier) {
      throw new Error('Invalid or expired verification code');
    }

    logger.info('Verifying MSG91 mobile OTP');

    const { data } = await axios.post(
      `${MSG91_WIDGET_BASE_URL}/verifyOtp`,
      {
        widgetId,
        tokenAuth,
        reqId,
        otp,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    logger.info('MSG91 mobile OTP verification completed');

    if (!data || data.type !== 'success') {
      throw new Error(data?.message || 'OTP verification failed');
    }

    await deleteOtpSession(reqId);

    return {
      mobile: phoneUtils.normalizePhone(identifier),
      raw: data,
    };
  }

  static async verifyAccessToken(accessToken) {
    const authKey = process.env.MSG91_AUTH_KEY;

    if (!authKey) {
      throw new Error('MSG91_AUTH_KEY is not configured');
    }

    if (!accessToken) {
      throw new Error('MSG91 widget access token is required');
    }

    logger.info('Verifying MSG91 widget access token');

    const { data } = await axios.post(
      MSG91_VERIFY_URL,
      {
        authkey: authKey,
        'access-token': accessToken,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    logger.info('MSG91 widget verification completed');

    if (!data || data.type !== 'success' || !data.message) {
      throw new Error(data?.message || 'MSG91 widget verification failed');
    }

    return {
      mobile: phoneUtils.normalizePhone(data.message),
      raw: data,
    };
  }
}

module.exports = Msg91WidgetService;
