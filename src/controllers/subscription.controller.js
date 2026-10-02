/**
 * Subscription Controller
 * Handles subscription-related HTTP requests
 */

const SubscriptionService = require('../services/subscription.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

/**
 * Retired endpoints. Plans are purchased through the website upgrade-session
 * flow and entitlement lives on the users table, so client-driven subscription
 * writes are refused.
 */
exports.retiredEndpoint = (req, res) => {
  responder.error(res, 410, 'This subscription endpoint is no longer available. Plans are managed through the StitchBook website.');
};

/**
 * POST /subscription/create
 * Create a new subscription after Cashfree payment
 */
exports.createSubscription = async (req, res) => {
  responder.error(res, 410, 'Legacy subscription creation is disabled. Use secure website Cashfree checkout.');
};

/**
 * GET /subscription/status
 * Get subscription status for authenticated user
 */
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const subscription = await SubscriptionService.getSubscriptionForActor(req.user);
    responder.success(res, 200, 'Subscription status retrieved', subscription);
  } catch (error) {
    logger.error('Get subscription error:', error.message);
    responder.error(res, 500, 'Failed to get subscription', error.message);
  }
};

exports.createUpgradeSession = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { plan = 'basic' } = req.body || {};

    const session = await SubscriptionService.createUpgradeSession(userId, plan);
    responder.success(res, 200, 'Upgrade session created', session);
  } catch (error) {
    logger.error('Create upgrade session error:', error.message);
    responder.error(res, 500, 'Failed to create upgrade session', error.message);
  }
};

exports.getUpgradeSession = async (req, res) => {
  try {
    const session = await SubscriptionService.validateUpgradeSession(req.params.sessionId);
    const user = await require('../models/user.model').getUserById(session.userId);
    responder.success(res, 200, 'Upgrade session validated', {
      sessionId: session.sessionId,
      plan: session.plan,
      expiresAt: session.expiresAt,
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      } : null,
      shop: null,
    });
  } catch (error) {
    logger.error('Validate upgrade session error:', error.message);
    responder.error(res, 404, 'Upgrade session is invalid or expired', error.message);
  }
};

exports.createUpgradeCheckout = async (req, res) => {
  try {
    const order = await SubscriptionService.createUpgradeCheckoutOrder(req.params.sessionId, req.body?.customerPhone);
    responder.success(res, 200, 'Checkout order created', order);
  } catch (error) {
    const errorMessage = error?.message || error?.error?.description || 'Failed to start checkout';
    logger.error('Create upgrade checkout error:', errorMessage);

    if (errorMessage === 'Cashfree credentials are not configured') {
      return responder.error(res, 500, 'Cashfree credentials are not configured');
    }

    if (error?.statusCode === 401 || errorMessage.toLowerCase().includes('authentication failed')) {
      return responder.error(res, 401, 'Cashfree authentication failed');
    }

    responder.error(res, 500, 'Failed to start checkout', errorMessage);
  }
};

exports.verifyUpgradeCheckout = async (req, res) => {
  try {
    const {cashfree_order_id} = req.body || {};
    if (!cashfree_order_id) return responder.error(res, 400, 'Missing payment verification details');
    const activation = await SubscriptionService.verifyUpgradeCheckoutPayment({sessionId:req.params.sessionId,cashfreeOrderId:cashfree_order_id});

    responder.success(res, 200, 'Subscription activated', activation);
  } catch (error) {
    const errorMessage = error?.message || 'Failed to verify checkout';
    logger.error('Verify upgrade checkout error:', errorMessage);
    responder.error(res, 400, 'Failed to verify checkout', errorMessage);
  }
};

/**
 * POST /subscription/verify
 * Verify subscription after Cashfree payment
 * Body: { provider_subscription_id, plan, status, expiry_date }
 */
exports.verifySubscription = async (req, res) => {
  responder.error(res, 410, 'Legacy subscription verification is disabled. Use secure website Cashfree checkout.');
};

/**
 * POST /subscription/check-active
 * Check if user has active subscription
 */
exports.checkActive = async (req, res) => {
  try {
    const subscription = await SubscriptionService.getSubscriptionForActor(req.user);
    responder.success(res, 200, 'Check completed', {
      is_active: Boolean(subscription?.isActive),
      status: subscription?.status,
      planType: subscription?.planType,
      requiresSubscription: Boolean(subscription?.requiresSubscription),
      canUseApp: Boolean(subscription?.canUseApp),
      trialEndDate: subscription?.trialEndDate,
      trialDaysRemaining: subscription?.trialDaysRemaining,
      daysRemaining: subscription?.daysRemaining,
    });
  } catch (error) {
    logger.error('Check active subscription error:', error.message);
    responder.error(res, 500, 'Failed to check subscription', error.message);
  }
};

/**
 * PUT /subscription/:subscriptionId/status
 * Update subscription status
 */
exports.updateSubscriptionStatus = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { status } = req.body;

    if (!status) {
      return responder.error(res, 400, 'Status is required');
    }

    const subscription = await SubscriptionService.updateSubscriptionStatus(
      subscriptionId,
      status
    );

    responder.success(res, 200, 'Subscription status updated', subscription);
  } catch (error) {
    logger.error('Update subscription status error:', error.message);
    responder.error(res, 500, error.message);
  }
};

/**
 * DELETE /subscription/:subscriptionId
 * Cancel subscription
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    await SubscriptionService.cancelSubscription(subscriptionId);
    responder.success(res, 200, 'Subscription cancelled');
  } catch (error) {
    logger.error('Cancel subscription error:', error.message);
    responder.error(res, 500, 'Failed to cancel subscription', error.message);
  }
};
