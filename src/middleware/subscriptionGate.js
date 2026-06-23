const SubscriptionService = require('../services/subscription.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

const subscriptionGate = async (req, res, next) => {
  try {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const subscription = await SubscriptionService.getSubscriptionForActor(req.user);

    if (subscription?.canUseApp) {
      if (
        req.user?.actorType === 'staff' &&
        (!subscription.features?.hasStaffManagement || Number(subscription.features?.maxStaff || 0) === 0)
      ) {
        return responder.error(res, 402, 'Staff app access is available from the Team plan. Ask the shop owner to upgrade.', {
          code: 'STAFF_PLAN_REQUIRED',
          planType: subscription.planType,
          recommendedPlan: 'team',
        });
      }

      req.subscription = subscription;
      return next();
    }

    return responder.error(res, 402, 'Free trial completed. Please take a subscription to continue.', {
      code: 'SUBSCRIPTION_REQUIRED',
      status: subscription?.status || 'trial_expired',
      requiresSubscription: true,
      trialEndDate: subscription?.trialEndDate,
      billingPath: '/billing',
    });
  } catch (error) {
    logger.error('Subscription gate failed:', error.message);
    return responder.error(res, 500, 'Unable to verify subscription access', error.message);
  }
};

module.exports = subscriptionGate;
