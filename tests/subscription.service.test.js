const test = require('node:test');
const assert = require('node:assert/strict');
const SubscriptionService = require('../src/services/subscription.service');

test('normalizeSubscriptionState returns trial access before expiry and active access after payment', () => {
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const paidEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const trialState = SubscriptionService.normalizeSubscriptionState({
    trial_start_at: now.toISOString(),
    trial_ends_at: trialEndsAt,
    subscription_status: 'inactive',
  });

  assert.equal(trialState.trialActive, true);
  assert.equal(trialState.subscriptionActive, false);
  assert.equal(trialState.canUseApp, true);
  assert.equal(trialState.requiresSubscription, false);
  assert.equal(trialState.status, 'trial');

  const paidState = SubscriptionService.normalizeSubscriptionState({
    trial_start_at: now.toISOString(),
    trial_ends_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    subscription_status: 'active',
    subscription_ends_at: paidEndsAt,
    plan: 'annual',
  });

  assert.equal(paidState.subscriptionActive, true);
  assert.equal(paidState.trialActive, false);
  assert.equal(paidState.canUseApp, true);
  assert.equal(paidState.plan, 'annual');
  assert.equal(paidState.status, 'active');
});
