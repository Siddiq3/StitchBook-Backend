const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-for-production';
process.env.PASSWORD_RESET_OTP_SECRET = 'test-password-reset-secret-at-least-32-characters';

const bcrypt = require('bcryptjs');
const AuthService = require('../src/services/auth.service');
const UserModel = require('../src/models/user.model');
const SessionService = require('../src/services/session.service');
const PasswordResetService = require('../src/services/passwordReset.service');
require('../src/config/redis').client.disconnect();

test('forgot password returns a generic result for unknown email without issuing an OTP', async (t) => {
  let issued = false;
  t.mock.method(UserModel, 'getUserByEmail', async () => null);
  t.mock.method(PasswordResetService, 'issueOtp', async () => { issued = true; });

  const result = await AuthService.requestPasswordReset('missing@example.com');
  assert.deepEqual(result, { requested: true });
  assert.equal(issued, false);
});

test('forgot password issues an OTP for an existing normalized email', async (t) => {
  let lookup;
  let issued;
  t.mock.method(UserModel, 'getUserByEmail', async (email) => {
    lookup = email;
    return { id: 4, email, name: 'Tailor Owner' };
  });
  t.mock.method(PasswordResetService, 'issueOtp', async (payload) => { issued = payload; });

  const result = await AuthService.requestPasswordReset(' OWNER@EXAMPLE.COM ');
  assert.deepEqual(result, { requested: true });
  assert.equal(lookup, 'owner@example.com');
  assert.deepEqual(issued, { email: 'owner@example.com', name: 'Tailor Owner' });
});

test('reset password verifies OTP, stores bcrypt password, and revokes all sessions', async (t) => {
  const user = { id: 11, email: 'owner@example.com' };
  let verified;
  let savedHash;
  let revokedUserId;

  t.mock.method(PasswordResetService, 'verifyAndConsumeOtp', async (email, otp) => {
    verified = { email, otp };
    return true;
  });
  t.mock.method(UserModel, 'getUserByEmail', async () => user);
  t.mock.method(UserModel, 'setPasswordHash', async (_id, hash) => {
    savedHash = hash;
    return user;
  });
  t.mock.method(SessionService, 'revokeAllSessionsForUser', async (userId) => {
    revokedUserId = userId;
    return { revoked: 2 };
  });

  const result = await AuthService.resetPasswordWithOtp({
    email: 'OWNER@EXAMPLE.COM',
    otp: '123456',
    newPassword: 'newpass123',
  });

  assert.deepEqual(result, { success: true });
  assert.deepEqual(verified, { email: 'owner@example.com', otp: '123456' });
  assert.equal(await bcrypt.compare('newpass123', savedHash), true);
  assert.equal(revokedUserId, 11);
});

test('reset password keeps OTP errors generic', async (t) => {
  t.mock.method(PasswordResetService, 'verifyAndConsumeOtp', async () => {
    const error = new Error('Invalid or expired verification code');
    error.code = 'INVALID_RESET_OTP';
    throw error;
  });

  await assert.rejects(
    () => AuthService.resetPasswordWithOtp({
      email: 'owner@example.com',
      otp: '000000',
      newPassword: 'newpass123',
    }),
    (error) => error.code === 'INVALID_RESET_OTP'
  );
});
