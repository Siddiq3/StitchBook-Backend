/**
 * Subscription Controller
 * Handles subscription-related HTTP requests
 */

const SubscriptionService = require('../services/subscription.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

const VALID_PLAN_KEYS = ['basic', 'team', 'pro', 'monthly', 'annual'];

const getClientPlatform = (req) => (
  req.get('x-client-platform') ||
  req.body?.clientPlatform ||
  req.query?.clientPlatform ||
  ''
).toLowerCase();

const ensureAppBillingRequest = (req, res) => {
  const platform = getClientPlatform(req);

  if (platform === 'web') {
    responder.error(res, 403, 'Subscription payments are managed inside the StitchBook mobile app');
    return false;
  }

  return true;
};

/**
 * POST /subscription/create
 * Create a new subscription after Razorpay payment
 */
exports.createSubscription = async (req, res) => {
  responder.error(res, 410, 'Legacy subscription creation is disabled. Use secure in-app Razorpay checkout.');
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
    const order = await SubscriptionService.createUpgradeCheckoutOrder(req.params.sessionId);
    responder.success(res, 200, 'Checkout order created', order);
  } catch (error) {
    const errorMessage = error?.message || error?.error?.description || 'Failed to start checkout';
    logger.error('Create upgrade checkout error:', errorMessage);

    if (errorMessage === 'Razorpay keys are not configured') {
      return responder.error(res, 500, 'Razorpay keys are not configured');
    }

    if (error?.statusCode === 401 || errorMessage.toLowerCase().includes('authentication failed')) {
      return responder.error(res, 401, 'Razorpay authentication failed');
    }

    responder.error(res, 500, 'Failed to start checkout', errorMessage);
  }
};

exports.verifyUpgradeCheckout = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return responder.error(res, 400, 'Missing payment verification details');
    }

    const activation = await SubscriptionService.verifyUpgradeCheckoutPayment({
      sessionId: req.params.sessionId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      plan,
    });

    responder.success(res, 200, 'Subscription activated', activation);
  } catch (error) {
    const errorMessage = error?.message || 'Failed to verify checkout';
    logger.error('Verify upgrade checkout error:', errorMessage);
    responder.error(res, 400, 'Failed to verify checkout', errorMessage);
  }
};

/**
 * POST /subscription/verify
 * Verify subscription after Razorpay payment
 * Body: { razorpay_subscription_id, plan, status, expiry_date }
 */
exports.verifySubscription = async (req, res) => {
  responder.error(res, 410, 'Legacy subscription verification is disabled. Use secure in-app Razorpay checkout.');
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

/**
 * POST /subscription/razorpay/create-order
 * Create Razorpay order for payment
 */
exports.createRazorpayOrder = async (req, res) => {
  try {
    if (!ensureAppBillingRequest(req, res)) return;

    const userId = req.user?.id || req.user?.userId;
    const shopId = req.user?.shop_id || userId;
    const shopIdSource = req.user?.shop_id ? 'shop_id' : 'user_id';
    const { billing_cycle } = req.body;

    // Validate request
    if (!billing_cycle || !VALID_PLAN_KEYS.includes(billing_cycle)) {
      return responder.error(res, 400, 'Valid billing_cycle (basic, team, or pro) is required');
    }

    if (!shopId) {
      return responder.error(res, 400, 'Unable to resolve shop_id: authenticated user must have a shop_id or user_id');
    }

    const orderData = await SubscriptionService.createRazorpayOrder(shopId, billing_cycle);

    logger.info(`Razorpay order created for ${shopIdSource}: ${shopId}`);
    responder.success(res, 200, 'Razorpay order created', {
      ...orderData,
      shopId,
      shopIdSource,
    });
  } catch (error) {
    const errorMessage = error?.message || error?.error?.description || String(error);
    logger.error('Create Razorpay order error:', errorMessage);

    if (error?.statusCode === 401 || errorMessage.toLowerCase().includes('authentication failed')) {
      return responder.error(
        res,
        401,
        'Razorpay authentication failed',
        'Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the backend .env. Use a matching test key id + test secret or live key id + live secret, then restart the backend.'
      );
    }

    if (errorMessage.includes('Missing shopId')) {
      return responder.error(res, 400, 'Unable to resolve shop_id for Razorpay order creation', errorMessage);
    }

    responder.error(res, 500, 'Failed to create Razorpay order', errorMessage);
  }
};

/**
 * POST /subscription/razorpay/verify-payment
 * Verify Razorpay payment and activate subscription
 */
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    if (!ensureAppBillingRequest(req, res)) return;

    const userId = req.user?.id || req.user?.userId;
    const shopId = req.user?.shop_id || userId;
    const shopIdSource = req.user?.shop_id ? 'shop_id' : 'user_id';
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, billing_cycle, checkout_token } = req.body;

    // Validate request
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !billing_cycle || !checkout_token) {
      return responder.error(res, 400, 'All Razorpay payment details, billing_cycle, and checkout_token are required');
    }

    if (!VALID_PLAN_KEYS.includes(billing_cycle)) {
      return responder.error(res, 400, 'Valid billing_cycle (basic, team, or pro) is required');
    }

    if (!shopId) {
      return responder.error(res, 400, 'Unable to resolve shop_id: authenticated user must have a shop_id or user_id');
    }

    const subscriptionData = await SubscriptionService.verifyRazorpayPayment(
      shopId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      billing_cycle,
      checkout_token
    );

    logger.info(`Payment verified and subscription activated for ${shopIdSource}: ${shopId}`);
    responder.success(res, 200, 'Payment verified and subscription activated', {
      ...subscriptionData,
      shopId,
      shopIdSource,
    });
  } catch (error) {
    const errorMessage = error?.message || error?.error?.description || String(error);
    logger.error('Verify Razorpay payment error:', errorMessage);

    if (errorMessage === 'Payment verification failed') {
      return responder.error(res, 400, 'Payment verification failed', { code: 'INVALID_SIGNATURE' });
    }

    if (
      errorMessage.includes('checkout session') ||
      errorMessage.includes('Checkout session') ||
      errorMessage.includes('not captured') ||
      errorMessage.includes('required')
    ) {
      return responder.error(res, 400, errorMessage);
    }

    if (errorMessage.includes('Missing shopId')) {
      return responder.error(res, 400, 'Unable to resolve shop_id for Razorpay verification', errorMessage);
    }

    responder.error(res, 500, 'Failed to verify payment', errorMessage);
  }
};
