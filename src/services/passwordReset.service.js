const crypto = require('crypto');
const { client: redis, isReady: isRedisReady, keyPrefix } = require('../config/redis');
const emailService = require('./email');
const { passwordResetEmail } = require('./email/passwordReset.template');

const OTP_EXPIRY_MINUTES = Math.max(5, Math.min(30, Number(process.env.PASSWORD_RESET_OTP_EXPIRY_MINUTES || 10)));
const OTP_EXPIRY_SECONDS = OTP_EXPIRY_MINUTES * 60;
const RESEND_SECONDS = Math.max(30, Math.min(300, Number(process.env.PASSWORD_RESET_OTP_RESEND_SECONDS || 60)));
const MAX_ATTEMPTS = Math.max(3, Math.min(10, Number(process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS || 5)));

const ensureRedis = () => {
  if (!isRedisReady()) {
    const error = new Error('Password reset service is temporarily unavailable');
    error.code = 'PASSWORD_RESET_UNAVAILABLE';
    throw error;
  }
};

const secret = () => String(process.env.PASSWORD_RESET_OTP_SECRET || process.env.JWT_REFRESH_SECRET || '');
const emailDigest = (email) => crypto.createHash('sha256').update(email).digest('hex');
const otpKey = (email) => `${keyPrefix}auth:password-reset:${emailDigest(email)}`;
const cooldownKey = (email) => `${keyPrefix}auth:password-reset-cooldown:${emailDigest(email)}`;
const hashOtp = (email, otp) => crypto.createHmac('sha256', secret()).update(`${email}:${otp}`).digest('hex');

exports.issueOtp = async ({ email, name }) => {
  ensureRedis();
  if (!secret()) {
    const error = new Error('Password reset secret is not configured');
    error.code = 'PASSWORD_RESET_NOT_CONFIGURED';
    throw error;
  }

  const cooldown = await redis.get(cooldownKey(email));
  if (cooldown) return { sent: false, throttled: true };

  const otp = String(crypto.randomInt(100000, 1000000));
  const record = JSON.stringify({
    hash: hashOtp(email, otp),
    attempts: 0,
    issuedAt: Date.now(),
  });

  await redis.set(otpKey(email), record, 'EX', OTP_EXPIRY_SECONDS);
  await redis.set(cooldownKey(email), '1', 'EX', RESEND_SECONDS);

  const message = passwordResetEmail({ name, otp, expiresMinutes: OTP_EXPIRY_MINUTES });
  try {
    await emailService.send({
      to: email,
      ...message,
      tags: [{ name: 'category', value: 'password_reset' }],
      idempotencyKey: `password-reset/${emailDigest(email)}/${Math.floor(Date.now() / (RESEND_SECONDS * 1000))}`,
    });
  } catch (error) {
    await Promise.all([redis.del(otpKey(email)), redis.del(cooldownKey(email))]);
    throw error;
  }

  return { sent: true, throttled: false };
};

exports.verifyAndConsumeOtp = async (email, otp) => {
  ensureRedis();
  const key = otpKey(email);
  const raw = await redis.get(key);
  if (!raw) {
    const error = new Error('Invalid or expired verification code');
    error.code = 'INVALID_RESET_OTP';
    throw error;
  }

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    await redis.del(key);
    const error = new Error('Invalid or expired verification code');
    error.code = 'INVALID_RESET_OTP';
    throw error;
  }

  if (Number(record.attempts || 0) >= MAX_ATTEMPTS) {
    await redis.del(key);
    const error = new Error('Invalid or expired verification code');
    error.code = 'INVALID_RESET_OTP';
    throw error;
  }

  const expected = Buffer.from(String(record.hash || ''), 'hex');
  const received = Buffer.from(hashOtp(email, String(otp || '')), 'hex');
  const valid = expected.length === received.length && expected.length > 0 && crypto.timingSafeEqual(expected, received);

  if (!valid) {
    record.attempts = Number(record.attempts || 0) + 1;
    const ttl = await redis.ttl(key);
    if (record.attempts >= MAX_ATTEMPTS || ttl <= 0) {
      await redis.del(key);
    } else {
      await redis.set(key, JSON.stringify(record), 'EX', ttl);
    }
    const error = new Error('Invalid or expired verification code');
    error.code = 'INVALID_RESET_OTP';
    throw error;
  }

  await redis.del(key);
  return true;
};

exports.config = {
  expiryMinutes: OTP_EXPIRY_MINUTES,
  resendSeconds: RESEND_SECONDS,
  maxAttempts: MAX_ATTEMPTS,
};
