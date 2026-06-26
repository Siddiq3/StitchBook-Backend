/**
 * Subscription Service
 * Handles subscription-related business logic
 */

const SubscriptionModel = require('../models/subscription.model');
const UserModel = require('../models/user.model');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { client: redis, isReady: isRedisReady, keyPrefix } = require('../config/redis');

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const FREE_TRIAL_DAYS = Math.max(1, Number(process.env.FREE_TRIAL_DAYS || 10));
const SUBSCRIPTION_CHECKOUT_TTL_SECONDS = 15 * 60;
const UPGRADE_SESSION_TTL_SECONDS = Math.max(300, Number(process.env.UPGRADE_SESSION_TTL_SECONDS || 7200));
const checkoutKey = (token) => `${keyPrefix}subscription_checkout:${token}`;
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
  static getRazorpayClient() {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys are not configured');
    }

    return new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  static getPlanConfig(billingCycle) {
    const plan = PLAN_CONFIG[billingCycle];
    if (!plan) {
      throw new Error('Invalid subscription plan');
    }
    return plan;
  }

  static verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(String(razorpaySignature || ''));

    return (
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    );
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
      razorpayOrderId: parsed.razorpayOrderId,
      amount: parsed.amount,
      currency: parsed.currency,
    };
  }

  static async createUpgradeCheckoutOrder(sessionId) {
    const session = await this.validateUpgradeSession(sessionId);
    const planConfig = this.getPlanConfig(session.plan);
    const razorpay = this.getRazorpayClient();

    const order = await razorpay.orders.create({
      amount: planConfig.amount * 100,
      currency: 'INR',
      receipt: `upgrade_${session.userId}_${Date.now()}`.slice(0, 40),
      notes: {
        stitch_upgrade_session_id: sessionId,
        stitch_plan: session.plan,
        stitch_user_id: String(session.userId),
      },
    });

    const updatedSession = {
      userId: session.userId,
      plan: session.plan,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      razorpayOrderId: order.id,
      amount: planConfig.amount * 100,
      currency: 'INR',
    };

    const secondsLeft = Math.max(300, Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
    await redis.setex(upgradeSessionKey(sessionId), secondsLeft, JSON.stringify(updatedSession));

    return {
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: planConfig.amount * 100,
      currency: 'INR',
      orderId: order.id,
      plan: session.plan,
      sessionId,
    };
  }

  static async verifyUpgradeCheckoutPayment({
    sessionId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    plan,
  }) {
    const session = await this.validateUpgradeSession(sessionId);

    if (!session.razorpayOrderId || session.razorpayOrderId !== razorpayOrderId) {
      throw new Error('Payment verification failed');
    }

    if (!this.verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
      throw new Error('Payment verification failed');
    }

    const activation = await this.activateUpgradeFromPayment({
      sessionId,
      plan: plan || session.plan,
    });

    await redis.del(upgradeSessionKey(sessionId));
    return {
      ...activation,
      razorpayPaymentId,
      razorpayOrderId,
    };
  }

  static async activateUpgradeFromPayment({ sessionId, plan }) {
    const session = await this.validateUpgradeSession(sessionId);
    const normalizedPlan = plan || session.plan;
    const now = new Date();
    const planConfig = this.getPlanConfig(normalizedPlan);
    const durationDays = planConfig.durationDays;
    const subscriptionEndsAt = new Date(now.getTime() + durationDays * MS_PER_DAY);

    const updatedUser = await UserModel.updateUserSubscription(session.userId, {
      plan: normalizedPlan,
      subscription_status: 'active',
      subscription_start_at: now,
      subscription_ends_at: subscriptionEndsAt,
    });

    return {
      userId: session.userId,
      plan: normalizedPlan,
      subscriptionStatus: 'active',
      subscriptionEndsAt: subscriptionEndsAt.toISOString(),
      user: updatedUser,
    };
  }

  /**
   * Create a new subscription after Razorpay payment
   * @param {number} userId - User ID
   * @param {object} subscriptionData - {plan, razorpay_subscription_id, status, expiry_date}
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
   * Verify subscription after Razorpay payment
   * @param {string} razorpaySubscriptionId - Razorpay subscription ID
   * @param {object} verificationData - {plan, status, expiry_date}
   * @returns {object} - Updated subscription
   */
  static async verifySubscription(razorpaySubscriptionId, verificationData) {
    try {
      const subscription = await SubscriptionModel.getSubscriptionByRazorpayId(razorpaySubscriptionId);
      
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const updatedSubscription = await SubscriptionModel.updateSubscription(
        subscription.id,
        verificationData
      );

      logger.info(`Subscription verified for Razorpay ID: ${razorpaySubscriptionId}`);
      return updatedSubscription;
    } catch (error) {
      logger.error('Error verifying subscription:', error.message);
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

  /**
   * Create Razorpay order
   * @param {number} shopId - Shop ID
   * @param {string} billingCycle - plan key
   * @returns {object} - Razorpay order data
   */
  static async createRazorpayOrder(shopId, billingCycle) {
    try {
      const plan = this.getPlanConfig(billingCycle);
      const amount = plan.amount;

      if (!shopId) {
        throw new Error('Missing shopId/userId for Razorpay order creation');
      }

      if (!isRedisReady()) {
        throw new Error('Subscription checkout is temporarily unavailable');
      }

      const razorpay = this.getRazorpayClient();

      const order = await razorpay.orders.create({
        amount: amount * 100, // paise
        currency: 'INR',
        receipt: `sub_${shopId}_${Date.now()}`.slice(0, 40),
        notes: {
          stitch_subscription: 'true',
          stitch_shop_id: shopId.toString(),
          billing_cycle: billingCycle,
        },
      });

      const checkoutToken = crypto.randomBytes(32).toString('hex');
      const session = {
        checkoutToken,
        shopId,
        billingCycle,
        planType: plan.planType,
        amount,
        currency: 'INR',
        razorpayOrderId: order.id,
        createdAt: new Date().toISOString(),
      };

      await redis.set(checkoutKey(checkoutToken), JSON.stringify(session), 'EX', SUBSCRIPTION_CHECKOUT_TTL_SECONDS);

      logger.info(`Razorpay order created: ${order.id} for shop: ${shopId}`);
      return {
        checkoutToken,
        expiresInSeconds: SUBSCRIPTION_CHECKOUT_TTL_SECONDS,
        orderId: order.id,
        amount: order.amount,
        displayAmount: amount,
      billingCycle,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planType: plan.planType,
      staffLimit: plan.staffLimit,
    };
    } catch (error) {
      logger.error('Error creating Razorpay order:', error?.message || error?.error?.description || String(error));
      throw error;
    }
  }

  /**
   * Verify Razorpay payment and activate subscription
   * @param {number} shopId - Shop ID
   * @param {string} razorpayOrderId - Razorpay order ID
   * @param {string} razorpayPaymentId - Razorpay payment ID
   * @param {string} razorpaySignature - Razorpay signature
   * @param {string} billingCycle - plan key
   * @returns {object} - Updated subscription data
   */
  static async verifyRazorpayPayment(shopId, razorpayOrderId, razorpayPaymentId, razorpaySignature, billingCycle, checkoutToken) {
    try {
      if (!shopId) {
        throw new Error('Missing shopId/userId for Razorpay payment verification');
      }

      const existingPayment = await SubscriptionModel.getSubscriptionByRazorpayPaymentId(razorpayPaymentId);
      if (existingPayment) {
        if (String(existingPayment.shop_id) !== String(shopId)) {
          throw new Error('Payment verification failed');
        }

        logger.info(`Razorpay payment already verified: ${razorpayPaymentId}`);
        const existingEndDate = existingPayment.end_date ? new Date(existingPayment.end_date) : null;
        const daysRemaining = existingEndDate
          ? Math.ceil((existingEndDate - new Date()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          id: existingPayment.id,
          shopId: existingPayment.shop_id,
          planType: existingPayment.plan_type,
          status: existingPayment.status,
          startDate: existingPayment.start_date,
          endDate: existingPayment.end_date,
          amount: existingPayment.amount,
          isActive: existingPayment.is_active,
          razorpayPaymentId,
          daysRemaining: Math.max(0, daysRemaining),
        };
      }

      if (!checkoutToken) {
        throw new Error('Checkout session is required');
      }

      if (!isRedisReady()) {
        throw new Error('Subscription checkout is temporarily unavailable');
      }

      const sessionKey = checkoutKey(checkoutToken);
      const rawSession = await redis.get(sessionKey);
      if (!rawSession) {
        throw new Error('Subscription checkout session expired or invalid');
      }

      const session = JSON.parse(rawSession);
      if (
        String(session.shopId) !== String(shopId) ||
        session.razorpayOrderId !== razorpayOrderId ||
        session.billingCycle !== billingCycle
      ) {
        throw new Error('Payment verification failed');
      }

      if (!this.verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
        throw new Error('Payment verification failed');
      }

      const razorpay = this.getRazorpayClient();
      const [razorpayOrder, razorpayPayment] = await Promise.all([
        razorpay.orders.fetch(razorpayOrderId),
        razorpay.payments.fetch(razorpayPaymentId),
      ]);

      const expectedAmount = Math.round(Number(session.amount) * 100);
      const orderNotes = razorpayOrder?.notes || {};
      if (
        String(razorpayOrder?.id) !== razorpayOrderId ||
        Number(razorpayOrder?.amount) !== expectedAmount ||
        razorpayOrder?.currency !== session.currency ||
        String(orderNotes.stitch_shop_id || '') !== String(shopId) ||
        orderNotes.billing_cycle !== billingCycle
      ) {
        throw new Error('Payment verification failed');
      }

      if (
        String(razorpayPayment?.order_id) !== razorpayOrderId ||
        Number(razorpayPayment?.amount) !== expectedAmount ||
        razorpayPayment?.currency !== session.currency ||
        razorpayPayment?.status !== 'captured'
      ) {
        throw new Error('Payment is not captured yet');
      }

      const planType = session.planType;
      const amount = session.amount;

      // Calculate dates
      const startDate = new Date();
      const endDate = new Date(startDate);
      const planConfig = this.getPlanConfig(billingCycle);
      if (planConfig.duration === 'year') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      // 3. Upsert subscription
      const subscriptionData = {
        shop_id: shopId,
        plan_type: planType,
        status: 'active',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        amount: amount,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        is_active: true,
      };

      const subscription = await SubscriptionModel.createSubscription(subscriptionData);
      await redis.del(sessionKey);

      // Calculate days remaining
      const today = new Date();
      const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

      logger.info(`Payment verified and subscription activated: ${subscription.id} for shop: ${shopId}`);

      return {
        id: subscription.id,
        shopId: shopId,
        planType: planType,
        status: 'active',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        amount: amount,
        isActive: true,
        razorpayPaymentId: razorpayPaymentId,
        daysRemaining: daysRemaining,
      };
    } catch (error) {
      logger.error('Error verifying Razorpay payment:', error.message);
      throw error;
    }
  }
}

module.exports = SubscriptionService;
