/**
 * Subscription Service
 * Handles subscription-related business logic
 */

const SubscriptionModel = require('../models/subscription.model');
const UserModel = require('../models/user.model');
const logger = require('../utils/logger');
const cashfree = require('./cashfree');
const db = require('../config/database');
const crypto = require('crypto');
const ledger = require('../models/billingLedger');
const { createRecoverableOrder } = require('./recoverableCheckout');
const { client: redis, isReady: isRedisReady, keyPrefix } = require('../config/redis');

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const FREE_TRIAL_DAYS = Math.max(1, Number(process.env.FREE_TRIAL_DAYS || 10));
const UPGRADE_SESSION_TTL_SECONDS = Math.max(300, Number(process.env.UPGRADE_SESSION_TTL_SECONDS || 7200));
const upgradeSessionKey = (sessionId) => `${keyPrefix}subscription_upgrade:${sessionId}`;

const PLAN_CONFIG = {
  basic: {
    amount: 299,
    planType: 'basic',
    duration: 'month',
    durationDays: 30,
    label: 'Basic',
    staffLimit: 0,
  },
  team: {
    amount: 399,
    planType: 'team',
    duration: 'month',
    durationDays: 30,
    label: 'Team',
    staffLimit: 2,
  },
  pro: {
    amount: 599,
    planType: 'pro',
    duration: 'month',
    durationDays: 30,
    label: 'Pro',
    staffLimit: 5,
  },
  monthly: {
    amount: 299,
    planType: 'basic',
    duration: 'month',
    durationDays: 30,
    label: 'Basic',
    staffLimit: 0,
  },
  annual: {
    amount: 1800,
    planType: 'pro',
    duration: 'year',
    durationDays: 365,
    label: 'Annual Pro',
    staffLimit: 5,
  },
};

const ACTIVE_PLAN_KEYS = Object.keys(PLAN_CONFIG);

class SubscriptionService {
  static getPlanConfig(billingCycle) {
    const plan = PLAN_CONFIG[billingCycle];
    if (!plan) {
      throw new Error('Invalid subscription plan');
    }
    return plan;
  }

  static getActorIds(actor = {}) {
    return {
      shopId: actor.shop_id || actor.shopId,
      userId: actor.id || actor.userId || actor.user_id,
    };
  }

  static buildTrialStatus(anchor = {}, fallback = {}) {
    const trialStart = new Date(anchor.trial_started_at || anchor.trial_start_at || fallback.created_at || Date.now());
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + FREE_TRIAL_DAYS);

    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((trialEnd - now) / MS_PER_DAY));
    const isTrialActive = trialEnd > now;
    const planType = isTrialActive ? 'trial' : 'expired';

    return {
      id: null,
      shopId: anchor.shop_id || fallback.shopId || null,
      userId: anchor.user_id || fallback.userId || null,
      planType,
      status: isTrialActive ? 'trial' : 'trial_expired',
      startDate: trialStart.toISOString(),
      endDate: trialEnd.toISOString(),
      trialStartDate: trialStart.toISOString(),
      trialEndDate: trialEnd.toISOString(),
      trialDaysTotal: FREE_TRIAL_DAYS,
      trialDaysRemaining: daysRemaining,
      amount: 0,
      isActive: isTrialActive,
      hasSubscription: false,
      requiresSubscription: !isTrialActive,
      canUseApp: isTrialActive,
      daysRemaining,
      features: SubscriptionModel.getPlanFeatures(planType),
    };
  }

  static normalizeSubscriptionState(user = {}) {
    const now = new Date();
    const trialStartAt = user.trial_start_at || user.trialStartAt || null;
    const trialEndsAt = user.trial_ends_at || user.trialEndsAt || null;
    const subscriptionStartAt = user.subscription_start_at || user.subscriptionStartAt || null;
    const subscriptionEndsAt = user.subscription_ends_at || user.subscriptionEndsAt || null;
    const subscriptionStatus = user.subscription_status || user.subscriptionStatus || 'inactive';
    const planFromUser = user.plan || user.selectedPlan || null;

    const trialActive = Boolean(trialEndsAt && new Date(trialEndsAt).getTime() > now.getTime());
    const subscriptionActive = Boolean(
      subscriptionStatus === 'active' &&
      subscriptionEndsAt &&
      new Date(subscriptionEndsAt).getTime() > now.getTime()
    );

    const plan = subscriptionActive ? planFromUser : trialActive ? 'trial' : null;
    const normalizedStatus = subscriptionActive ? 'active' : (trialActive ? 'trial' : 'trial_expired');
    const activePlanConfig = subscriptionActive ? (PLAN_CONFIG[plan] || PLAN_CONFIG.monthly) : null;
    const planType = subscriptionActive ? activePlanConfig.planType : (trialActive ? 'trial' : 'expired');

    const trialEndsIso = trialEndsAt ? new Date(trialEndsAt).toISOString() : null;
    const subscriptionEndsIso = subscriptionEndsAt ? new Date(subscriptionEndsAt).toISOString() : null;
    const trialStartIso = trialStartAt ? new Date(trialStartAt).toISOString() : null;

    return {
      trialActive,
      subscriptionActive,
      plan,
      subscriptionStatus: subscriptionActive ? 'active' : (trialActive ? 'trial' : subscriptionStatus),
      trialEndsAt: trialEndsIso,
      subscriptionEndsAt: subscriptionEndsIso,
      status: normalizedStatus,
      planType,
      isActive: trialActive || subscriptionActive,
      canUseApp: trialActive || subscriptionActive,
      requiresSubscription: !(trialActive || subscriptionActive),
      startDate: subscriptionStartAt ? new Date(subscriptionStartAt).toISOString() : trialStartIso,
      endDate: subscriptionEndsIso || trialEndsIso,
      trialStartDate: trialStartIso,
      trialEndDate: trialEndsIso,
      trialDaysTotal: FREE_TRIAL_DAYS,
      trialDaysRemaining: trialEndsIso ? Math.max(0, Math.ceil((new Date(trialEndsIso) - now) / MS_PER_DAY)) : 0,
      daysRemaining: subscriptionEndsIso ? Math.max(0, Math.ceil((new Date(subscriptionEndsIso) - now) / MS_PER_DAY)) : 0,
      amount: subscriptionActive ? activePlanConfig.amount : 0,
      features: SubscriptionModel.getPlanFeatures(planType),
    };
  }

  static async applyTrialEntitlement(subscription, actor = {}) {
    if (subscription?.hasSubscription) {
      return {
        ...subscription,
        requiresSubscription: !subscription.isActive,
        canUseApp: Boolean(subscription.isActive),
      };
    }

    const { shopId, userId } = this.getActorIds(actor);
    let anchor = null;

    if (shopId) {
      anchor = await SubscriptionModel.getTrialAnchorByShopId(shopId);
    }

    if (!anchor && userId) {
      anchor = await SubscriptionModel.getTrialAnchorByUserId(userId);
    }

    return this.buildTrialStatus(anchor, { shopId, userId, created_at: actor.created_at });
  }

  static async createUpgradeSession(userId, plan = 'basic') {
    if (!userId) {
      throw new Error('User is required to create an upgrade session');
    }

    if (!ACTIVE_PLAN_KEYS.includes(plan)) {
      throw new Error('Invalid subscription plan');
    }

    if (!isRedisReady()) {
      throw new Error('Upgrade checkout is temporarily unavailable');
    }

    const sessionId = crypto.randomBytes(16).toString('hex');
    const payload = {
      userId,
      plan,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + UPGRADE_SESSION_TTL_SECONDS * 1000).toISOString(),
    };

    await redis.setex(upgradeSessionKey(sessionId), UPGRADE_SESSION_TTL_SECONDS, JSON.stringify(payload));

    const baseUrl = this.getUpgradePageBaseUrl();
    return {
      sessionId,
      upgradeUrl: `${baseUrl}/upgrade/session/${sessionId}`,
    };
  }

  static getUpgradePageBaseUrl() {
    const configured =
      process.env.WEB_APP_URL ||
      process.env.FRONTEND_URL ||
      process.env.FRONTEND_URLS?.split(',').find(Boolean) ||
      (process.env.NODE_ENV === 'production' ? null : 'http://localhost:5173');

    if (!configured) {
      throw new Error('WEB_APP_URL is required to create upgrade sessions');
    }

    if (process.env.NODE_ENV === 'production') require('../config/production').requireHttps(configured, 'WEB_APP_URL');
    return String(configured).replace(/\/$/, '');
  }

  static async validateUpgradeSession(sessionId) {
    if (!sessionId) {
      throw new Error('Upgrade session ID is required');
    }

    if (!isRedisReady()) {
      throw new Error('Upgrade checkout is temporarily unavailable');
    }

    const payload = await redis.get(upgradeSessionKey(sessionId));
    if (!payload) {
      throw new Error('Upgrade session not found or expired');
    }

    const parsed = JSON.parse(payload);
    const owner = await UserModel.getUserById(parsed.userId);
    if (!owner || owner.deletion_started_at) {
      throw new Error('This account is unavailable for checkout');
    }
    if (Number(new Date(parsed.expiresAt)) <= Date.now()) {
      await redis.del(upgradeSessionKey(sessionId));
      throw new Error('Upgrade session has expired');
    }

    return {
      sessionId,
      userId: parsed.userId,
      plan: parsed.plan,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      cashfreeOrderId: parsed.cashfreeOrderId,
      amount: parsed.amount,
      currency: parsed.currency,
    };
  }

  static async createUpgradeCheckoutOrder(sessionId, customerPhone) {
    const session = await this.validateUpgradeSession(sessionId);
    const planConfig = this.getPlanConfig(session.plan);
    const user = await UserModel.getUserById(session.userId);
    const order = await createRecoverableOrder({
      id: sessionId, userId: session.userId, plan: session.plan,
      amount: Math.round(planConfig.amount * 100), receipt: `upgrade_${sessionId}`,
      customer: {...user, phone: user.phone || customerPhone},
      returnUrl: `${this.getUpgradePageBaseUrl()}/upgrade/session/${sessionId}?order_id={order_id}`,
    });
    const updated = {...session, cashfreeOrderId: order.order_id, amount: planConfig.amount, currency:'INR'};
    const secondsLeft = Math.max(1, Math.ceil((new Date(session.expiresAt)-Date.now())/1000));
    await redis.setex(upgradeSessionKey(sessionId), secondsLeft, JSON.stringify(updated));
    return {orderId:order.order_id, paymentSessionId:order.payment_session_id, mode:cashfree.getMode(), amount:planConfig.amount, currency:'INR', plan:session.plan, sessionId};
  }

  static async verifyUpgradeCheckoutPayment({sessionId, cashfreeOrderId}) {
    const session = await this.validateUpgradeSession(sessionId);
    if (!session.cashfreeOrderId || session.cashfreeOrderId !== cashfreeOrderId) throw new Error('Payment verification failed');
    const payment = await cashfree.verifiedPayment(cashfreeOrderId, this.getPlanConfig(session.plan).amount);
    const activation = await this.activatePaidPlan({userId:session.userId,plan:session.plan,cashfreePaymentId:String(payment.cf_payment_id)});
    return {...activation,cashfreeOrderId,cashfreePaymentId:String(payment.cf_payment_id)};
  }

  static async activatePaidPlan({userId, plan, cashfreePaymentId}) {
    if (!userId) throw new Error('User is required to activate a subscription');
    if (!cashfreePaymentId) throw new Error('Payment reference is required to activate a subscription');
    return ledger.applyPayment({userId,plan,paymentId:`cashfree:${cashfreePaymentId}`,durationDays:this.getPlanConfig(plan).durationDays});
  }

  // Persisted billing intents bind ownership and price even after Redis expires.
  static async activateFromWebhookPayment({orderId, paymentId}) {
    const intent = await db.queryRow('SELECT * FROM billing_intents WHERE provider_order_id=$1 OR receipt=$1', [orderId]);
    if (!intent || !orderId?.startsWith('upgrade_')) return {ignored:true,reason:'Not a subscription upgrade order'};
    const amount = this.getPlanConfig(intent.plan).amount;
    if (Number(intent.amount) !== Math.round(amount*100)) throw new Error('Checkout amount mismatch');
    const payment = await cashfree.verifiedPayment(orderId, amount);
    if (String(payment.cf_payment_id) !== String(paymentId)) throw new Error('Payment reference mismatch');
    return this.activatePaidPlan({userId:intent.user_id,plan:intent.plan,cashfreePaymentId:String(payment.cf_payment_id)});
  }

  /**
   * Create a new subscription after verified payment
   * @param {number} userId - User ID
   * @param {object} subscriptionData - {plan, provider_subscription_id, status, expiry_date}
   * @returns {object} - Created subscription
   */
  static async createSubscription(userId, subscriptionData) {
    try {
      const subscription = await SubscriptionModel.createSubscription({
        user_id: userId,
        ...subscriptionData,
      });

      logger.info(`Subscription created for user: ${userId}`);
      return subscription;
    } catch (error) {
      logger.error('Error creating subscription:', error.message);
      throw error;
    }
  }

  /**
   * Get subscription for user
   * @param {number} userId - User ID
   * @returns {object} - Subscription data
   */
  static async getSubscriptionByUser(userId) {
    try {
      return await SubscriptionModel.getSubscriptionByUserId(userId);
    } catch (error) {
      logger.error('Error getting subscription:', error.message);
      throw error;
    }
  }

  /**
   * Get subscription status for the current actor. Prefer shop entitlement,
   * because web payments activate the shop plan and mobile only reads it.
   * @param {object} actor - Authenticated user/actor object
   * @returns {object} - Subscription status
   */
  static async getSubscriptionForActor(actor = {}) {
    try {
      const { shopId, userId } = this.getActorIds(actor);
      if (!userId && !shopId) {
        return this.buildTrialStatus({}, { userId: null, created_at: actor.created_at });
      }

      let subscriptionUserId = userId;
      if (shopId && actor.actorType === 'staff') {
        const anchor = await SubscriptionModel.getTrialAnchorByShopId(shopId);
        subscriptionUserId = anchor?.user_id || userId;
      }

      const user = await UserModel.getUserById(subscriptionUserId);
      if (!user) {
        return this.buildTrialStatus({}, { shopId, userId, created_at: actor.created_at });
      }

      return this.normalizeSubscriptionState(user);
    } catch (error) {
      logger.error('Error getting actor subscription:', error.message);
      throw error;
    }
  }

  /**
   * Check if user has active subscription
   * @param {number} userId - User ID
   * @returns {boolean} - Is active?
   */
  static async isActive(userId) {
    try {
      return await SubscriptionModel.isSubscriptionActive(userId);
    } catch (error) {
      logger.error('Error checking subscription status:', error.message);
      throw error;
    }
  }

  /**
   * Check active subscription for current actor. Prefer shop entitlement.
   * @param {object} actor - Authenticated actor
   * @returns {boolean}
   */
  static async isActiveForActor(actor = {}) {
    try {
      const subscription = await this.getSubscriptionForActor(actor);
      return Boolean(subscription?.isActive);
    } catch (error) {
      logger.error('Error checking actor subscription status:', error.message);
      throw error;
    }
  }

  /**
   * Update subscription status
   * @param {number} subscriptionId - Subscription ID
   * @param {string} status - New status (active, inactive, expired)
   * @returns {object} - Updated subscription
   */
  static async updateSubscriptionStatus(subscriptionId, status) {
    try {
      const validStatuses = ['active', 'inactive', 'expired'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      const subscription = await SubscriptionModel.updateSubscriptionStatus(subscriptionId, status);
      
      if (!subscription) {
        throw new Error('Failed to update subscription status');
      }

      logger.info(`Updated subscription status: ${subscriptionId}`);
      return subscription;
    } catch (error) {
      logger.error('Error updating subscription status:', error.message);
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param {number} subscriptionId - Subscription ID
   * @returns {boolean} - Success status
   */
  static async cancelSubscription(subscriptionId) {
    try {
      const result = await SubscriptionModel.deleteSubscription(subscriptionId);
      
      if (!result) {
        throw new Error('Failed to cancel subscription');
      }

      logger.info(`Cancelled subscription: ${subscriptionId}`);
      return true;
    } catch (error) {
      logger.error('Error cancelling subscription:', error.message);
      throw error;
    }
  }

}

module.exports = SubscriptionService;
