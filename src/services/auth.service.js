/**
 * Authentication Service
 * Handles core authentication logic
 * Production-ready with proper error handling and logging
 *
 * FLOW:
 * 1. Frontend: User completes OTP verification on Firebase
 * 2. Frontend: Gets Firebase ID Token
 * 3. Frontend: Sends ID Token to backend
 * 4. Backend: Verifies token using Firebase Admin SDK
 * 5. Backend: Extracts phone from token
 * 6. Backend: Finds or creates user (phone is unique identifier)
 * 7. Backend: Issues JWT token
 * 8. Frontend: Stores JWT in AsyncStorage
 * 9. Frontend: Uses JWT for all subsequent requests
 */

const UserModel = require('../models/user.model');
const ShopModel = require('../models/shop.model');
const StaffModel = require('../models/staff.model');
const FirebaseService = require('./firebase.service');
const GoogleAuthService = require('./googleAuth.service');
const Msg91WidgetService = require('./msg91Widget.service');
const TokenService = require('./token.service');
const SessionService = require('./session.service');
const PasswordResetService = require('./passwordReset.service');
const TokenBlacklistService = require('./tokenBlacklist.service');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const phoneUtils = require('../utils/phoneUtils');
const logger = require('../utils/logger');
const { mergePermissions } = require('./permissions.service');

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('stitchbook-invalid-password', 12);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const validateNewPassword = (password) => {
  const value = String(password || '');
  if (value.length < 8 || value.length > 128 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    const error = new Error('Password must be 8-128 characters and include a letter and a number');
    error.code = 'INVALID_PASSWORD';
    throw error;
  }
  return value;
};
const validateRegistration = ({ name, email, phone, password }) => {
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);
  if (cleanName.length < 2 || cleanName.length > 80) {
    const error = new Error('Enter your name');
    error.code = 'INVALID_NAME';
    throw error;
  }
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
    const error = new Error('Enter a valid email address');
    error.code = 'INVALID_EMAIL';
    throw error;
  }
  return {
    name: cleanName,
    email: cleanEmail,
    phone: phoneUtils.normalizePhone(phone),
    password: validateNewPassword(password),
  };
};

const isStaffMobileLoginEnabled = () =>
  String(process.env.ENABLE_STAFF_MOBILE_LOGIN || '').toLowerCase() === 'true';

const linkStaffAccountIfAllowed = async (user) => {
  if (!isStaffMobileLoginEnabled()) return user;
  if (!user?.phone) return user;

  const staff = await StaffModel.getStaffByPhone(user.phone);
  if (!staff || !staff.is_active || !staff.can_login) {
    return user;
  }

  await StaffModel.linkStaffUser(staff.id, user.id);

  if (Number(user.shop_id) !== Number(staff.shop_id)) {
    return UserModel.updateUser(user.id, {
      shop_id: staff.shop_id,
      auth_provider: user.auth_provider || 'mobile',
      last_login: new Date(),
    });
  }

  return user;
};

const linkStaffEmailIfAllowed = async (user) => {
  if (!user?.email) return user;

  const staff = await StaffModel.getStaffByEmail(user.email);
  if (!staff || !staff.is_active || !staff.can_login) {
    return user;
  }

  await StaffModel.linkStaffUser(staff.id, user.id);

  if (Number(user.shop_id) !== Number(staff.shop_id)) {
    return UserModel.updateUser(user.id, {
      shop_id: staff.shop_id,
      auth_provider: user.auth_provider || 'google',
      last_login: new Date(),
    });
  }

  return user;
};

const assertStaffPhoneCanLogin = async (phone) => {
  if (!phone) return;
  const staff = await StaffModel.getStaffByPhone(phone);
  if (staff && staff.is_active && !isStaffMobileLoginEnabled()) {
    throw new Error('Staff mobile login is not enabled. Please login with the staff Google email.');
  }
  if (staff && staff.is_active && !staff.can_login) {
    throw new Error('This staff member does not have app login access');
  }
};

const assertStaffEmailCanLogin = async (email) => {
  if (!email) return;
  const staff = await StaffModel.getStaffByEmail(email);
  if (staff && staff.is_active && !staff.can_login) {
    throw new Error('This staff member does not have app login access');
  }
};

const formatUser = async (user) => {
  const [ownedShop, staff] = await Promise.all([
    ShopModel.getShopByUserId(user.id),
    StaffModel.getStaffByUserId(user.id),
  ]);
  const isOwner = Boolean(ownedShop);
  const role = isOwner ? 'owner' : staff?.access_role || 'pending_owner';
  const permissions = isOwner
    ? ['*']
    : staff
      ? staff.can_login
        ? mergePermissions(staff.access_role, staff.permissions)
        : []
      : ['shop:read', 'shop:write'];

  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    shopId: ownedShop?.id || staff?.shop_id || user.shop_id,
    authProvider: user.auth_provider,
    role,
    staffId: staff?.id || null,
    permissions,
    lastLogin: user.last_login,
    createdAt: user.created_at,
  };
};

const createLoginResponse = async (user, meta = {}) => {
  const sessionId = uuidv4();
  const tokenPair = TokenService.generateTokenPair({
    userId: user.id,
    phone: user.phone,
    email: user.email,
    name: user.name,
    sessionId,
  });

  await SessionService.createSession({
    sessionId,
    userId: user.id,
    refreshJti: tokenPair.refreshJti,
    ip: meta.ip,
    userAgent: meta.userAgent,
    device: meta.device,
    platform: meta.platform,
  });

  return {
    success: true,
    token: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    user: await formatUser(user),
    expiresIn: tokenPair.expiresIn,
  };
};

const mergeAuthProvider = (currentProvider, providerToAdd) => {
  const parts = new Set(
    String(currentProvider || '')
      .split('_')
      .filter(Boolean)
  );

  parts.add(providerToAdd);
  if (parts.has('firebase')) parts.add('mobile');

  const ordered = ['google', 'mobile', 'firebase'].filter((part) => parts.has(part));
  return ordered.length ? ordered.join('_') : providerToAdd;
};

class AuthService {
  static async registerWithPassword(payload, meta = {}) {
    const clean = validateRegistration(payload);
    await assertStaffEmailCanLogin(clean.email);

    const [emailOwner, phoneOwner] = await Promise.all([
      UserModel.getUserByEmail(clean.email),
      UserModel.getUserByPhone(clean.phone),
    ]);
    if (emailOwner || phoneOwner) {
      const error = new Error('An account already exists with this email or mobile number');
      error.code = 'ACCOUNT_ALREADY_EXISTS';
      throw error;
    }

    const passwordHash = await bcrypt.hash(clean.password, 12);
    let user = await UserModel.createPasswordUser({
      name: clean.name,
      email: clean.email,
      phone: clean.phone,
      passwordHash,
    });

    user = await linkStaffEmailIfAllowed(user);
    user = await linkStaffAccountIfAllowed(user);
    return createLoginResponse(user, meta);
  }

  static async loginWithPassword(identifier, password, meta = {}) {
    const rawIdentifier = String(identifier || '').trim();
    const rawPassword = String(password || '');
    if (!rawIdentifier || !rawPassword || rawPassword.length > 128) {
      const error = new Error('Invalid email/mobile number or password');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    let normalizedIdentifier;
    try {
      normalizedIdentifier = rawIdentifier.includes('@')
        ? normalizeEmail(rawIdentifier)
        : phoneUtils.normalizePhone(rawIdentifier);
    } catch {
      normalizedIdentifier = rawIdentifier;
    }

    const user = await UserModel.getUserForPasswordLogin(normalizedIdentifier);
    const matches = await bcrypt.compare(rawPassword, user?.password_hash || DUMMY_PASSWORD_HASH);
    if (!user || !user.password_hash || !matches) {
      const error = new Error('Invalid email/mobile number or password');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    await assertStaffEmailCanLogin(user.email);

    const updated = await UserModel.updateUser(user.id, {
      last_login: new Date(),
      auth_provider: user.auth_provider || 'password',
    });
    return createLoginResponse(updated, meta);
  }

  static async setOrChangePassword(userId, { currentPassword, newPassword }, currentSessionId = null) {
    const password = validateNewPassword(newPassword);
    const existingHash = await UserModel.getPasswordHash(userId);
    if (existingHash) {
      const validCurrent = await bcrypt.compare(String(currentPassword || ''), existingHash);
      if (!validCurrent) {
        const error = new Error('Current password is incorrect');
        error.code = 'INVALID_CURRENT_PASSWORD';
        throw error;
      }
      const samePassword = await bcrypt.compare(password, existingHash);
      if (samePassword) {
        const error = new Error('Choose a different password');
        error.code = 'PASSWORD_REUSED';
        throw error;
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await UserModel.setPasswordHash(userId, passwordHash);

    // Credential changes revoke every other trusted device, while keeping the
    // current authenticated session alive so the user is not unexpectedly
    // signed out of the device that performed the change.
    if (currentSessionId) {
      const sessions = await SessionService.listSessionsForUser(userId);
      await Promise.all(
        sessions
          .filter((session) => session.sessionId !== currentSessionId)
          .map((session) => SessionService.revokeSession(session.sessionId))
      );
    }

    return { user: await formatUser(user), passwordEnabled: true };
  }

  static async requestPasswordReset(email) {
    const cleanEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
      const error = new Error('Enter a valid email address');
      error.code = 'INVALID_EMAIL';
      throw error;
    }

    const user = await UserModel.getUserByEmail(cleanEmail);
    if (user) {
      await PasswordResetService.issueOtp({
        email: cleanEmail,
        name: user.name,
      });
    }

    // Deliberately generic so callers cannot discover registered emails.
    return { requested: true };
  }

  static async resetPasswordWithOtp({ email, otp, newPassword }) {
    const cleanEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
      const error = new Error('Invalid or expired verification code');
      error.code = 'INVALID_RESET_OTP';
      throw error;
    }
    if (!/^\d{6}$/.test(String(otp || '').trim())) {
      const error = new Error('Invalid or expired verification code');
      error.code = 'INVALID_RESET_OTP';
      throw error;
    }

    const password = validateNewPassword(newPassword);
    await PasswordResetService.verifyAndConsumeOtp(cleanEmail, String(otp).trim());

    const user = await UserModel.getUserByEmail(cleanEmail);
    if (!user) {
      const error = new Error('Invalid or expired verification code');
      error.code = 'INVALID_RESET_OTP';
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await UserModel.setPasswordHash(user.id, passwordHash);
    await SessionService.revokeAllSessionsForUser(user.id);

    return { success: true };
  }

  static async loginWithGoogleToken(idToken, meta = {}) {
    try {
      logger.info('Starting Google authentication');
      const googleUser = await GoogleAuthService.verifyIdToken(idToken);
      await assertStaffEmailCanLogin(googleUser.email);

      let user = await UserModel.getUserByGoogleId(googleUser.googleId);

      if (!user && googleUser.email) {
        user = await UserModel.getUserByEmail(googleUser.email);
      }

      if (!user) {
        user = await UserModel.createUser({
          email: googleUser.email,
          name: googleUser.name,
          googleId: googleUser.googleId,
          avatar: googleUser.avatar,
          authProvider: 'google',
        });
      } else {
        user = await UserModel.updateUser(user.id, {
          email: googleUser.email || user.email,
          name: user.name || googleUser.name,
          google_id: googleUser.googleId,
          avatar: googleUser.avatar || user.avatar,
          auth_provider: user.auth_provider === 'mobile' ? 'google_mobile' : user.auth_provider || 'google',
          last_login: new Date(),
        });
      }

      user = await linkStaffEmailIfAllowed(user);

      logger.info(`✓ Google login successful for user: ${user.id}`);
      return createLoginResponse(user, meta);
    } catch (error) {
      logger.error('Google authentication failed:', error.message);
      throw error;
    }
  }

  static async loginWithMsg91Widget(accessToken, meta = {}) {
    try {
      logger.info('Starting MSG91 mobile authentication');
      const { mobile } = await Msg91WidgetService.verifyAccessToken(accessToken);
      return this.loginWithVerifiedMobile(mobile, meta);
    } catch (error) {
      logger.error('MSG91 mobile authentication failed:', error.message);
      throw error;
    }
  }

  static async loginWithMsg91Otp(reqId, otp, meta = {}) {
    try {
      logger.info('Starting MSG91 backend OTP authentication');
      const { mobile } = await Msg91WidgetService.verifyMobileOtp(reqId, otp);
      return this.loginWithVerifiedMobile(mobile, meta);
    } catch (error) {
      logger.error('MSG91 backend OTP authentication failed:', error.message);
      throw error;
    }
  }

  static async loginWithVerifiedMobile(mobile, meta = {}) {
    try {
      await assertStaffPhoneCanLogin(mobile);

      let user = await UserModel.getUserByPhone(mobile);

      if (!user) {
        user = await UserModel.createUser({
          phone: mobile,
          name: `User ${mobile.slice(-4)}`,
          authProvider: 'mobile',
        });
      } else {
        user = await UserModel.updateUser(user.id, {
          auth_provider: user.auth_provider || 'mobile',
          last_login: new Date(),
        });
      }

      user = await linkStaffAccountIfAllowed(user);

      logger.info(`✓ Mobile OTP login successful for user: ${user.id}`);
      return createLoginResponse(user, meta);
    } catch (error) {
      logger.error('MSG91 mobile authentication failed:', error.message);
      throw error;
    }
  }

  static async getAuthMethods(userId) {
    const user = await UserModel.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const passwordHash = await UserModel.getPasswordHash(userId);
    return {
      password: {
        linked: Boolean(passwordHash),
      },
      google: {
        linked: Boolean(user.google_id),
        email: user.email || null,
        avatar: user.avatar || null,
      },
      mobile: {
        linked: Boolean(user.phone),
        phone: user.phone || null,
      },
      authProvider: user.auth_provider,
    };
  }

  static async linkGoogleToUser(userId, idToken) {
    if (!idToken) {
      throw new Error('Google ID token is required');
    }

    const currentUser = await UserModel.getUserById(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    const googleUser = await GoogleAuthService.verifyIdToken(idToken);
    await assertStaffEmailCanLogin(googleUser.email);

    const existingOwner = await UserModel.getIdentityOwner({
      googleId: googleUser.googleId,
      excludeUserId: userId,
    });

    if (existingOwner) {
      const error = new Error('This Google account is already linked to another StitchBook account');
      error.code = 'IDENTITY_ALREADY_LINKED';
      throw error;
    }

    const emailOwner = await UserModel.getIdentityOwner({
      email: googleUser.email,
      excludeUserId: userId,
    });

    if (emailOwner) {
      const error = new Error('This email is already used by another StitchBook account. Login to that account first; accounts are not merged automatically.');
      error.code = 'EMAIL_ALREADY_USED';
      throw error;
    }

    const user = await UserModel.updateUser(userId, {
      email: googleUser.email || currentUser.email,
      name: currentUser.name || googleUser.name,
      google_id: googleUser.googleId,
      avatar: googleUser.avatar || currentUser.avatar,
      auth_provider: mergeAuthProvider(currentUser.auth_provider, 'google'),
      last_login: new Date(),
    });

    return {
      user: await formatUser(user),
      methods: await this.getAuthMethods(userId),
    };
  }

  static async linkMobileToUser(userId, reqId, otp) {
    if (!reqId || !otp) {
      throw new Error('OTP request id and OTP are required');
    }

    const currentUser = await UserModel.getUserById(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    const { mobile } = await Msg91WidgetService.verifyMobileOtp(reqId, otp);
    await assertStaffPhoneCanLogin(mobile);

    const existingOwner = await UserModel.getIdentityOwner({
      phone: mobile,
      excludeUserId: userId,
    });

    if (existingOwner) {
      const error = new Error('This mobile number is already linked to another StitchBook account');
      error.code = 'PHONE_ALREADY_LINKED';
      throw error;
    }

    const user = await UserModel.updateUser(userId, {
      phone: mobile,
      name: currentUser.name || `User ${mobile.slice(-4)}`,
      auth_provider: mergeAuthProvider(currentUser.auth_provider, 'mobile'),
      last_login: new Date(),
    });

    const linkedUser = await linkStaffAccountIfAllowed(user);

    return {
      user: await formatUser(linkedUser),
      methods: await this.getAuthMethods(userId),
    };
  }

  static async linkMobileAccessTokenToUser(userId, accessToken) {
    if (!accessToken) {
      throw new Error('MSG91 widget access token is required');
    }

    const currentUser = await UserModel.getUserById(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    const { mobile } = await Msg91WidgetService.verifyAccessToken(accessToken);
    await assertStaffPhoneCanLogin(mobile);

    const existingOwner = await UserModel.getIdentityOwner({
      phone: mobile,
      excludeUserId: userId,
    });

    if (existingOwner) {
      const error = new Error('This mobile number is already linked to another StitchBook account');
      error.code = 'PHONE_ALREADY_LINKED';
      throw error;
    }

    const user = await UserModel.updateUser(userId, {
      phone: mobile,
      name: currentUser.name || `User ${mobile.slice(-4)}`,
      auth_provider: mergeAuthProvider(currentUser.auth_provider, 'mobile'),
      last_login: new Date(),
    });

    const linkedUser = await linkStaffAccountIfAllowed(user);

    return {
      user: await formatUser(linkedUser),
      methods: await this.getAuthMethods(userId),
    };
  }

  /**
   * Login with Firebase ID Token
   * Main authentication endpoint
   *
   * @param {string} idToken - Firebase ID Token from frontend
   * @returns {object} - { token, user, expiresIn }
   * @throws {Error} - If authentication fails
   */
  static async loginWithFirebaseToken(idToken, meta = {}) {
    try {
      logger.info('🔐 Starting Firebase authentication...');

      // Step 1: Verify Firebase token and extract user info
      const userInfo = await FirebaseService.verifyTokenAndGetUserInfo(idToken);
      const { phone, firebaseUid, name } = userInfo;

      logger.info('✓ Firebase token verified');

      // Step 2: Normalize phone (should already be done, but double-check)
      const normalizedPhone = phoneUtils.normalizePhone(phone);
      await assertStaffPhoneCanLogin(normalizedPhone);

      // Step 3: Find existing user by phone
      let user = await UserModel.getUserByPhone(normalizedPhone);

      // Step 4: Create new user if doesn't exist
      if (!user) {
        logger.info('📱 New mobile user detected');

        user = await UserModel.createUser({
          phone: normalizedPhone,
          name: name,
          firebaseUid: firebaseUid,
          authProvider: 'firebase',
        });

        logger.info(`✓ New user created: ${user.id}`);
      } else {
        logger.info(`✓ Existing user found: ${user.id}`);

        // Update Firebase UID if different (in case user switched Firebase account)
        if (user.firebase_uid !== firebaseUid) {
          await UserModel.updateUser(user.id, {
            firebase_uid: firebaseUid,
          });
        }
      }

      user = await UserModel.updateUser(user.id, { last_login: new Date() });
      user = await linkStaffAccountIfAllowed(user);

      logger.info(`✓ JWT token generated for user: ${user.id}`);
      return createLoginResponse(user, meta);
    } catch (error) {
      logger.error('Firebase authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify JWT token from Authorization header
   * Used to validate ongoing sessions
   *
   * @param {string} token - JWT token
   * @returns {object} - { valid: true, userId, phone }
   * @throws {Error} - If token is invalid
   */
  static async verifyJWTToken(token) {
    try {
      const decoded = TokenService.verifyAccessToken(token);

      if (await TokenBlacklistService.isAccessTokenBlacklisted(decoded.jti)) {
        throw new Error('Access token has been revoked');
      }

      if (!decoded.sessionId) {
        throw new Error('Invalid token session');
      }

      const session = await SessionService.getSession(decoded.sessionId);
      if (!session || !session.active || session.userId !== decoded.userId) {
        throw new Error('Session is not active');
      }

      // Optionally verify user still exists
      const user = await UserModel.getUserById(decoded.userId);

      if (!user) {
        throw new Error('User not found. Token may be stale.');
      }

      return {
        valid: true,
        userId: decoded.userId,
        phone: decoded.phone,
      };
    } catch (error) {
      logger.error('JWT verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Refresh JWT token
   * Issues a new access token using refresh token
   *
   * @param {string} refreshToken - Refresh token
   * @returns {object} - { token, refreshToken, expiresIn }
   */
  static async refreshAccessToken(refreshToken) {
    try {
      const decoded = TokenService.verifyRefreshToken(refreshToken);

      if (await TokenBlacklistService.isRefreshTokenBlacklisted(decoded.jti)) {
        logger.warn(`Suspicious refresh reuse detected: revoked refresh jti=${decoded.jti} userId=${decoded.userId}`);
        throw new Error('Refresh token has been revoked');
      }

      if (!decoded.sessionId) {
        throw new Error('Refresh token missing session information');
      }

      const session = await SessionService.getSession(decoded.sessionId);
      if (!session || !session.active || session.userId !== decoded.userId) {
        throw new Error('Session is not active');
      }

      if (session.refreshJti !== decoded.jti) {
        logger.warn(`Refresh token reuse detected: oldRefreshJti=${decoded.jti} sessionId=${decoded.sessionId} userId=${decoded.userId}`);
        await TokenBlacklistService.blacklistRefreshToken(decoded.jti);
        await SessionService.revokeSession(decoded.sessionId);
        throw new Error('Refresh token reuse detected');
      }

      const tokenPair = TokenService.generateTokenPair({
        userId: decoded.userId,
        phone: decoded.phone,
        email: decoded.email || null,
        name: decoded.name || null,
        sessionId: decoded.sessionId,
      });

      await SessionService.rotateRefreshToken(decoded.sessionId, decoded.jti, tokenPair.refreshJti);
      await TokenBlacklistService.blacklistRefreshToken(decoded.jti);

      const decodedAccessToken = TokenService.decodeToken(tokenPair.accessToken);
      const expiresIn = decodedAccessToken && decodedAccessToken.exp
        ? decodedAccessToken.exp - Math.floor(Date.now() / 1000)
        : null;

      logger.info(`✓ Access token refreshed for user: ${decoded.userId}`);

      return {
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn,
      };
    } catch (error) {
      logger.error('Token refresh failed:', error.message);
      throw error;
    }
  }

  /**
   * Logout user
   * Invalidates token on server (token blacklisting)
   * Frontend should also clear AsyncStorage
   *
   * @param {string} token - JWT token to blacklist
   * @returns {object} - { success: true }
   */
  static async logout(token) {
    try {
      const decoded = TokenService.verifyAccessToken(token);

      await TokenBlacklistService.blacklistAccessToken(decoded.jti);

      if (decoded.sessionId) {
        const session = await SessionService.getSession(decoded.sessionId);
        if (session) {
          await TokenBlacklistService.blacklistRefreshToken(session.refreshJti);
          await SessionService.revokeSession(decoded.sessionId);
        }
      }

      logger.info(`✓ User logged out: ${decoded.userId}`);

      return {
        success: true,
        message: 'Logged out successfully. Clear token from frontend storage.',
      };
    } catch (error) {
      logger.error('Logout error:', error.message);
      throw error;
    }
  }

  /**
   * Get user profile from JWT
   * Retrieves full user data
   *
   * @param {string} token - JWT token
   * @returns {object} - User data
   */
  static async getUserProfile(token) {
    try {
      const decoded = TokenService.verifyAccessToken(token);

      const user = await UserModel.getUserById(decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        shopId: user.shop_id,
        authProvider: user.auth_provider,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    } catch (error) {
      logger.error('Get user profile error:', error.message);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {number} userId - User ID
   * @param {object} updateData - Data to update { name }
   * @returns {object} - Updated user
   */
  static async updateUserProfile(userId, updateData) {
    try {
      const allowedUpdates = { name: updateData.name };

      const user = await UserModel.updateUser(userId, allowedUpdates);

      logger.info(`✓ User profile updated: ${userId}`);

      return user;
    } catch (error) {
      logger.error('Update user profile error:', error.message);
      throw error;
    }
  }

  static async listSessions(userId, currentSessionId = null) {
    const sessions = await SessionService.listSessionsForUser(userId);
    return sessions.map((session) => ({
      id: session.sessionId,
      device: session.device || 'Unknown device',
      platform: session.platform || null,
      ipAddress: session.ip || null,
      trustedDevice: session.trustedDevice,
      createdAt: session.createdAt,
      lastActiveAt: session.lastRefreshAt || session.createdAt,
      current: session.sessionId === currentSessionId,
    }));
  }

  static async logoutAll(userId) {
    return SessionService.revokeAllSessionsForUser(userId);
  }

  static async logoutSession(userId, sessionId) {
    const session = await SessionService.getSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found');
    }

    await SessionService.revokeSession(sessionId);
    if (session.refreshJti) {
      await TokenBlacklistService.blacklistRefreshToken(session.refreshJti);
    }

    return { success: true };
  }
}

module.exports = AuthService;
