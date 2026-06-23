/**
 * Subscription Model
 * Handles all subscription-related database operations
 */

const db = require('../config/database');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

class SubscriptionModel {
  /**
   * Create a new subscription
   * @param {object} subscriptionData - Subscription data
   * @returns {object} - Created subscription
   */
  static async createSubscription(subscriptionData) {
    const {
      user_id, shop_id, plan_type, status, start_date, end_date, amount,
      razorpay_payment_id, razorpay_order_id, is_active
    } = subscriptionData;

    const query = `
      INSERT INTO subscriptions (
        user_id, shop_id, plan_type, status, start_date, end_date, amount,
        razorpay_payment_id, razorpay_order_id, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (shop_id)
      DO UPDATE SET
        plan_type = excluded.plan_type,
        status = excluded.status,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        amount = excluded.amount,
        razorpay_payment_id = excluded.razorpay_payment_id,
        razorpay_order_id = excluded.razorpay_order_id,
        is_active = excluded.is_active,
        updated_at = NOW()
      RETURNING id, user_id, shop_id, plan_type, status, start_date, end_date, amount,
                razorpay_payment_id, razorpay_order_id, is_active, created_at, updated_at;
    `;

    return db.queryRow(query, [
      user_id, shop_id, plan_type, status, start_date, end_date, amount,
      razorpay_payment_id, razorpay_order_id, is_active
    ]);
  }

  /**
   * Get subscription by ID
   * @param {number} subscriptionId - Subscription ID
   * @returns {object} - Subscription data
   */
  static async getSubscriptionById(subscriptionId) {
    const query = `
      SELECT id, user_id, shop_id, plan_type, status, start_date, end_date, amount,
             razorpay_payment_id, razorpay_order_id, is_active, created_at, updated_at
      FROM subscriptions
      WHERE id = $1;
    `;

    return db.queryRow(query, [subscriptionId]);
  }

  /**
   * Get subscription by user ID
   * @param {number} userId - User ID
   * @returns {object} - Subscription data (latest)
   */
  static async getSubscriptionByUserId(userId) {
    const query = `
      SELECT id, user_id, shop_id, plan_type, status, start_date, end_date, amount,
             razorpay_payment_id, razorpay_order_id, is_active, created_at, updated_at
      FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    const subscription = await db.queryRow(query, [userId]);

    if (!subscription) {
      return {
        id: null,
        shopId: null,
        planType: 'free',
        status: 'inactive',
        startDate: null,
        endDate: null,
        amount: 0,
        isActive: false,
        hasSubscription: false,
        requiresSubscription: true,
        canUseApp: false,
        daysRemaining: 0,
        features: {
          maxCustomers: 0,
          maxOrders: 0,
          hasPortfolio: false,
          hasReports: false,
          hasStaffManagement: false,
        },
      };
    }

    // Calculate days remaining
    const today = new Date();
    const endDate = subscription.end_date;
    const daysRemaining = endDate
      ? Math.ceil((new Date(endDate) - today) / MS_PER_DAY)
      : 0;
    const isActive = Boolean(
      subscription.is_active &&
      subscription.status === 'active' &&
      daysRemaining > 0
    );
    const status = isActive ? subscription.status : 'expired';

    // Map plan_type to features
    const features = this.getPlanFeatures(subscription.plan_type);

    return {
      id: subscription.id,
      shopId: subscription.shop_id,
      planType: subscription.plan_type,
      status,
      startDate: subscription.start_date,
      endDate: subscription.end_date,
      amount: subscription.amount,
      isActive,
      hasSubscription: true,
      requiresSubscription: !isActive,
      canUseApp: isActive,
      daysRemaining: Math.max(0, daysRemaining),
      features,
    };
  }

  /**
   * Get subscription by shop ID and format it for API responses.
   * @param {number} shopId - Shop ID
   * @returns {object} - Subscription data
   */
  static async getSubscriptionStatusByShopId(shopId) {
    const subscription = await this.getSubscriptionByShopId(shopId);

    if (!subscription) {
      return {
        id: null,
        shopId,
        planType: 'free',
        status: 'inactive',
        startDate: null,
        endDate: null,
        amount: 0,
        isActive: false,
        hasSubscription: false,
        requiresSubscription: true,
        canUseApp: false,
        daysRemaining: 0,
        features: this.getPlanFeatures('free'),
      };
    }

    const today = new Date();
    const endDate = subscription.end_date;
    const daysRemaining = endDate
      ? Math.ceil((new Date(endDate) - today) / MS_PER_DAY)
      : 0;
    const isActive = Boolean(
      subscription.is_active &&
      subscription.status === 'active' &&
      daysRemaining > 0
    );
    const status = isActive ? subscription.status : 'expired';

    return {
      id: subscription.id,
      shopId: subscription.shop_id,
      planType: subscription.plan_type,
      status,
      startDate: subscription.start_date,
      endDate: subscription.end_date,
      amount: subscription.amount,
      isActive,
      hasSubscription: true,
      requiresSubscription: !isActive,
      canUseApp: isActive,
      daysRemaining: Math.max(0, daysRemaining),
      features: this.getPlanFeatures(subscription.plan_type),
    };
  }

  /**
   * Update subscription status
   * @param {number} subscriptionId - Subscription ID
   * @param {string} status - New status (active, inactive, expired)
   * @returns {object} - Updated subscription
   */
  static async updateSubscriptionStatus(subscriptionId, status) {
    const query = `
      UPDATE subscriptions
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, user_id, shop_id, plan_type, status, start_date, end_date, amount,
                razorpay_payment_id, razorpay_order_id, is_active, created_at, updated_at;
    `;

    return db.queryRow(query, [status, subscriptionId]);
  }

  /**
   * Update subscription after Razorpay verification
   * @param {number} subscriptionId - Subscription ID
   * @param {object} updateData - Data to update
   * @returns {object} - Updated subscription
   */
  static async updateSubscription(subscriptionId, updateData) {
    const allowedFields = ['plan_type', 'status', 'start_date', 'end_date', 'amount', 'razorpay_payment_id', 'razorpay_order_id', 'is_active'];
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
      return this.getSubscriptionById(subscriptionId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(subscriptionId);

    const query = `
      UPDATE subscriptions
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, user_id, shop_id, plan_type, status, start_date, end_date, amount,
                razorpay_payment_id, razorpay_order_id, is_active, created_at, updated_at;
    `;

    return db.queryRow(query, values);
  }

  /**
   * Check if user has active subscription
   * @param {number} userId - User ID
   * @returns {boolean} - Is subscription active?
   */
  static async isSubscriptionActive(userId) {
    const query = `
      SELECT id FROM subscriptions
      WHERE user_id = $1 AND status = 'active' AND is_active = true AND end_date > NOW()
      LIMIT 1;
    `;

    const result = await db.queryRow(query, [userId]);
    return result !== null;
  }

  /**
   * Check if a shop has active subscription
   * @param {number} shopId - Shop ID
   * @returns {boolean} - Is active?
   */
  static async isSubscriptionActiveByShopId(shopId) {
    const query = `
      SELECT id FROM subscriptions
      WHERE shop_id = $1 AND status = 'active' AND is_active = true AND end_date > NOW()
      LIMIT 1;
    `;

    const result = await db.queryRow(query, [shopId]);
    return result !== null;
  }

  /**
   * Get subscription by Razorpay ID
   * @param {string} razorpaySubscriptionId - Razorpay subscription ID
   * @returns {object} - Subscription data
   */
  static async getSubscriptionByRazorpayId(razorpaySubscriptionId) {
    const query = `
      SELECT id, user_id, shop_id, plan_type, status, start_date, end_date, amount,
             razorpay_payment_id, razorpay_order_id, is_active, created_at, updated_at
      FROM subscriptions
      WHERE razorpay_subscription_id = $1;
    `;

    return db.queryRow(query, [razorpaySubscriptionId]);
  }

  /**
   * Get subscription by Razorpay payment ID
   * @param {string} razorpayPaymentId - Razorpay payment ID
   * @returns {object} - Subscription data
   */
  static async getSubscriptionByRazorpayPaymentId(razorpayPaymentId) {
    const query = `
      SELECT id, user_id, shop_id, plan_type, status, start_date, end_date, amount,
             razorpay_payment_id, razorpay_order_id, is_active, created_at, updated_at
      FROM subscriptions
      WHERE razorpay_payment_id = $1
      LIMIT 1;
    `;

    return db.queryRow(query, [razorpayPaymentId]);
  }

  /**
   * Get subscription by shop ID
   * @param {number} shopId - Shop ID
   * @returns {object} - Subscription data
   */
  static async getSubscriptionByShopId(shopId) {
    const query = `
      SELECT id, user_id, shop_id, plan_type, status, start_date, end_date, amount,
             razorpay_payment_id, razorpay_order_id, is_active, created_at, updated_at
      FROM subscriptions
      WHERE shop_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    return db.queryRow(query, [shopId]);
  }

  static async getTrialAnchorByShopId(shopId) {
    const query = `
      SELECT
        s.id AS shop_id,
        s.user_id,
        COALESCE(s.created_at, u.created_at, NOW()) AS trial_started_at
      FROM shops s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
      LIMIT 1;
    `;

    return db.queryRow(query, [shopId]);
  }

  static async getTrialAnchorByUserId(userId) {
    const query = `
      SELECT
        u.id AS user_id,
        COALESCE(u.shop_id, s.id) AS shop_id,
        COALESCE(s.created_at, u.created_at, NOW()) AS trial_started_at
      FROM users u
      LEFT JOIN shops s ON s.user_id = u.id
      WHERE u.id = $1
      ORDER BY s.created_at ASC NULLS LAST
      LIMIT 1;
    `;

    return db.queryRow(query, [userId]);
  }

  /**
   * Get features for a plan type
   * @param {string} planType - Plan type
   * @returns {object} - Plan features
   */
  static getPlanFeatures(planType) {
    const features = {
      free: {
        maxCustomers: 10,
        maxOrders: 5,
        maxStaff: 0,
        hasPortfolio: false,
        hasReports: false,
        hasStaffManagement: false,
      },
      expired: {
        maxCustomers: 0,
        maxOrders: 0,
        maxStaff: 0,
        hasPortfolio: false,
        hasReports: false,
        hasStaffManagement: false,
      },
      trial: {
        maxCustomers: 500,
        maxOrders: 200,
        maxStaff: 2,
        hasPortfolio: true,
        hasReports: true,
        hasStaffManagement: true,
      },
      basic: {
        maxCustomers: 100,
        maxOrders: 50,
        maxStaff: 0,
        hasPortfolio: true,
        hasReports: false,
        hasStaffManagement: false,
      },
      team: {
        maxCustomers: 300,
        maxOrders: 150,
        maxStaff: 2,
        hasPortfolio: true,
        hasReports: true,
        hasStaffManagement: true,
      },
      pro: {
        maxCustomers: 500,
        maxOrders: 300,
        maxStaff: 5,
        hasPortfolio: true,
        hasReports: true,
        hasStaffManagement: true,
      },
      premium: {
        maxCustomers: 500,
        maxOrders: 200,
        maxStaff: 5,
        hasPortfolio: true,
        hasReports: true,
        hasStaffManagement: true,
      },
      enterprise: {
        maxCustomers: -1, // unlimited
        maxOrders: -1, // unlimited
        maxStaff: -1, // unlimited
        hasPortfolio: true,
        hasReports: true,
        hasStaffManagement: true,
      },
    };

    return features[planType] || features.free;
  }
}

module.exports = SubscriptionModel;
