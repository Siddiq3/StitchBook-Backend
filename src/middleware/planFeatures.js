const SubscriptionService = require('../services/subscription.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

const requirePlanFeature = (
  feature,
  {
    code = 'PLAN_FEATURE_REQUIRED',
    message = 'This feature is not included in your current StitchBook plan.',
    recommendedPlan = 'team',
  } = {}
) => async (req, res, next) => {
  try {
    const subscription = req.subscription || await SubscriptionService.getSubscriptionForActor(req.user);

    if (!subscription?.canUseApp) {
      return responder.error(res, 402, 'Your StitchBook plan is not active.', {
        code: 'SUBSCRIPTION_REQUIRED',
        status: subscription?.status || 'trial_expired',
        requiresSubscription: true,
        trialEndDate: subscription?.trialEndDate,
        billingPath: '/billing',
      });
    }

    if (!subscription.features?.[feature]) {
      return responder.error(res, 402, message, {
        code,
        planType: subscription.planType,
        recommendedPlan,
      });
    }

    req.subscription = subscription;
    return next();
  } catch (error) {
    logger.error('Plan feature gate failed:', error.message);
    return responder.error(res, 500, 'Unable to verify plan features', error.message);
  }
};

module.exports = {
  requirePlanFeature,
};
