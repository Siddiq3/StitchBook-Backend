/**
 * User Model
 * Handles all user-related database operations
 * Production-ready with optimized queries and proper error handling
 */

const db = require('../config/database');
const logger = require('../utils/logger');

class UserModel {
  /**
   * Create a new user
   * Phone, email, or provider ID can identify a user depending on auth provider.
   *
   * @param {object} userData - User data { phone, email, name, firebaseUid, googleId, avatar, authProvider }
   * @returns {object} - Created user
   * @throws {Error} - If user already exists or query fails
   */
  static async createUser(userData) {
    try {
      const {
        phone = null,
        email = null,
        name = null,
        firebaseUid = null,
        googleId = null,
        avatar = null,
        authProvider = 'mobile',
        trialStartAt = new Date(),
        trialEndsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        plan = null,
        subscriptionStatus = 'trial',
        subscriptionStartAt = null,
        subscriptionEndsAt = null,
      } = userData;

      const query = `
        INSERT INTO users (
          phone, email, name, firebase_uid, google_id, avatar, auth_provider,
          trial_start_at, trial_ends_at, plan, subscription_status,
          subscription_start_at, subscription_ends_at, last_login, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), NOW())
        RETURNING id, phone, email, name, firebase_uid, google_id, avatar, auth_provider, shop_id,
          trial_start_at, trial_ends_at, plan, subscription_status,
          subscription_start_at, subscription_ends_at, last_login, created_at, updated_at;
      `;

      const user = await db.queryRow(query, [
        phone,
        email,
        name,
        firebaseUid,
        googleId,
        avatar,
        authProvider,
        trialStartAt,
        trialEndsAt,
        plan,
        subscriptionStatus,
        subscriptionStartAt,
        subscriptionEndsAt,
      ]);

      logger.info(`✓ User created: ID=${user.id}, Provider=${authProvider}`);
      return user;
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        logger.warn(`User already exists for provided identity`);
        throw new Error('User with this identity already exists');
      }
      logger.error('Create user error:', error.message);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {number} userId - User ID
   * @returns {object} - User data or null
   */
  static async getUserById(userId) {
    try {
      const query = `
        SELECT id, phone, email, name, firebase_uid, google_id, avatar, auth_provider, shop_id,
          trial_start_at, trial_ends_at, plan, subscription_status,
          subscription_start_at, subscription_ends_at, last_login, created_at, updated_at
        FROM users
        WHERE id = $1;
      `;

      return db.queryRow(query, [userId]);
    } catch (error) {
      logger.error('Get user by ID error:', error.message);
      throw error;
    }
  }

  /**
   * Get user by phone number (PRIMARY LOOKUP)
   * Phone is the unique identifier in the system
   *
   * @param {string} phone - Phone number (must be in E.164 format)
   * @returns {object} - User data or null
   */
  static async getUserByPhone(phone) {
    try {
      const query = `
        SELECT id, phone, email, name, firebase_uid, google_id, avatar, auth_provider, shop_id,
          trial_start_at, trial_ends_at, plan, subscription_status,
          subscription_start_at, subscription_ends_at, last_login, created_at, updated_at
        FROM users
        WHERE phone = $1;
      `;

      return db.queryRow(query, [phone]);
    } catch (error) {
      logger.error('Get user by phone error:', error.message);
      throw error;
    }
  }

  /**
   * Get user by Firebase UID
   * Useful for linking accounts or data migration
   *
   * @param {string} firebaseUid - Firebase authentication UID
   * @returns {object} - User data or null
   */
  static async getUserByFirebaseUid(firebaseUid) {
    try {
      const query = `
        SELECT id, phone, email, name, firebase_uid, google_id, avatar, auth_provider, shop_id,
          trial_start_at, trial_ends_at, plan, subscription_status,
          subscription_start_at, subscription_ends_at, last_login, created_at, updated_at
        FROM users
        WHERE firebase_uid = $1;
      `;

      return db.queryRow(query, [firebaseUid]);
    } catch (error) {
      logger.error('Get user by Firebase UID error:', error.message);
      throw error;
    }
  }

  static async getUserByEmail(email) {
    try {
      const query = `
        SELECT id, phone, email, name, firebase_uid, google_id, avatar, auth_provider, shop_id,
          trial_start_at, trial_ends_at, plan, subscription_status,
          subscription_start_at, subscription_ends_at, last_login, created_at, updated_at
        FROM users
        WHERE LOWER(email) = LOWER($1);
      `;

      return db.queryRow(query, [email]);
    } catch (error) {
      logger.error('Get user by email error:', error.message);
      throw error;
    }
  }

  static async getUserByGoogleId(googleId) {
    try {
      const query = `
        SELECT id, phone, email, name, firebase_uid, google_id, avatar, auth_provider, shop_id,
          trial_start_at, trial_ends_at, plan, subscription_status,
          subscription_start_at, subscription_ends_at, last_login, created_at, updated_at
        FROM users
        WHERE google_id = $1;
      `;

      return db.queryRow(query, [googleId]);
    } catch (error) {
      logger.error('Get user by Google ID error:', error.message);
      throw error;
    }
  }

  /**
   * Update user
   * @param {number} userId - User ID
   * @param {object} updateData - Data to update { name, shop_id, auth_provider }
   * @returns {object} - Updated user
   */
  static async updateUser(userId, updateData) {
    try {
      const allowedFields = [
        'name',
        'phone',
        'email',
        'firebase_uid',
        'google_id',
        'avatar',
        'shop_id',
        'auth_provider',
        'trial_start_at',
        'trial_ends_at',
        'plan',
        'subscription_status',
        'subscription_start_at',
        'subscription_ends_at',
        'last_login',
      ];
      const updates = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (updates.length === 0) {
        return this.getUserById(userId);
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      const query = `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, phone, email, name, firebase_uid, google_id, avatar, auth_provider, shop_id,
          trial_start_at, trial_ends_at, plan, subscription_status,
          subscription_start_at, subscription_ends_at, last_login, created_at, updated_at;
      `;

      const user = await db.queryRow(query, values);

      logger.info(`✓ User updated: ID=${userId}`);
      return user;
    } catch (error) {
      logger.error('Update user error:', error.message);
      throw error;
    }
  }

  /**
   * Delete user
   * @param {number} userId - User ID
   * @returns {boolean} - Success status
   */
  static async deleteUser(userId) {
    try {
      const query = `DELETE FROM users WHERE id = $1;`;

      const result = await db.query(query, [userId]);
      const deleted = result.rowCount > 0;

      if (deleted) {
        logger.info(`✓ User deleted: ID=${userId}`);
      }

      return deleted;
    } catch (error) {
      logger.error('Delete user error:', error.message);
      throw error;
    }
  }

  /**
   * Check if user exists by phone
   * Useful for duplicate checking
   *
   * @param {string} phone - Phone number
   * @returns {boolean} - True if user exists
   */
  static async userExistsByPhone(phone) {
    try {
      const query = `SELECT COUNT(*) as count FROM users WHERE phone = $1;`;
      const result = await db.queryRow(query, [phone]);
      return result.count > 0;
    } catch (error) {
      logger.error('Check user exists error:', error.message);
      throw error;
    }
  }

  /**
   * Get all users (admin operation)
   * @returns {array} - Array of users
   */
  static async getAllUsers() {
    try {
      const query = `
        SELECT id, phone, email, name, firebase_uid, google_id, avatar, auth_provider, shop_id,
          trial_start_at, trial_ends_at, plan, subscription_status,
          subscription_start_at, subscription_ends_at, last_login, created_at, updated_at
        FROM users
        ORDER BY created_at DESC;
      `;

      return db.queryAll(query, []);
    } catch (error) {
      logger.error('Get all users error:', error.message);
      throw error;
    }
  }

  static async updateUserSubscription(userId, updateData) {
    try {
      const allowedFields = [
        'trial_start_at',
        'trial_ends_at',
        'plan',
        'subscription_status',
        'subscription_start_at',
        'subscription_ends_at',
      ];
      const updates = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key) && value !== undefined) {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (updates.length === 0) {
        return this.getUserById(userId);
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      const query = `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, phone, email, name, firebase_uid, google_id, avatar, auth_provider, shop_id,
          trial_start_at, trial_ends_at, plan, subscription_status,
          subscription_start_at, subscription_ends_at, last_login, created_at, updated_at;
      `;

      return db.queryRow(query, values);
    } catch (error) {
      logger.error('Update user subscription error:', error.message);
      throw error;
    }
  }
}

module.exports = UserModel;
