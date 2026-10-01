process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-not-for-production';
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

// ---------------------------------------------------------------------------
// Payment activation hardening. Redis, the users table and Razorpay are stubbed.
// ---------------------------------------------------------------------------
const { client: redisClient } = require('../src/config/redis');
const UserModel = require('../src/models/user.model');

redisClient.disconnect();

const setupPaymentStubs = () => {
  const store = new Map();
  const updates = [];
  redisClient.status = 'ready';
  redisClient.set = async (key, value, ...args) => {
    if (args.includes('NX') && store.has(key)) return null;
    store.set(key, value);
    return 'OK';
  };
  redisClient.del = async (key) => (store.delete(key) ? 1 : 0);
  UserModel.updateUserSubscription = async (userId, data) => {
    updates.push({ userId, ...data });
    return { id: userId, ...data };
  };
  UserModel.getUserById = async (userId) => ({ id: userId, plan: 'basic', subscription_status: 'active' });
  require('../src/models/billingLedger').applyPayment = async ({userId,plan,paymentId,durationDays}) => {
    if(store.has(paymentId)) return {userId,plan,subscriptionStatus:'active',alreadyProcessed:true};
    const subscriptionEndsAt = new Date(Date.now()+durationDays*86400000).toISOString();
    const result = await UserModel.updateUserSubscription(userId,{plan,subscription_status:'active',subscription_ends_at:subscriptionEndsAt});
    store.set(paymentId,result);
    return {userId,plan,subscriptionStatus:'active',subscriptionEndsAt};
  };
  return { store, updates };
};

test('checkout verification activates the session plan, not a browser-supplied plan', async (t) => {
  const { updates } = setupPaymentStubs();
  t.mock.method(SubscriptionService, 'validateUpgradeSession', async () => ({
    sessionId: 's1', userId: 'u1', plan: 'basic', razorpayOrderId: 'order_1',
  }));
  t.mock.method(SubscriptionService, 'verifyRazorpaySignature', () => true);
  t.mock.method(SubscriptionService, 'getRazorpayClient', () => ({payments:{fetch:async()=>({status:'captured',order_id:'order_1',amount:29900,currency:'INR'})}}));

  const result = await SubscriptionService.verifyUpgradeCheckoutPayment({
    sessionId: 's1',
    razorpayOrderId: 'order_1',
    razorpayPaymentId: 'pay_1',
    razorpaySignature: 'sig',
    plan: 'annual',
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].plan, 'basic');
  assert.equal(result.plan, 'basic');
  const days = (new Date(result.subscriptionEndsAt) - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(days > 29 && days <= 30);
});

test('checkout verification rejects an order id that does not belong to the session', async (t) => {
  const { updates } = setupPaymentStubs();
  t.mock.method(SubscriptionService, 'validateUpgradeSession', async () => ({
    sessionId: 's1', userId: 'u1', plan: 'basic', razorpayOrderId: 'order_1',
  }));
  t.mock.method(SubscriptionService, 'verifyRazorpaySignature', () => true);
  t.mock.method(SubscriptionService, 'getRazorpayClient', () => ({payments:{fetch:async()=>({status:'captured',order_id:'order_1',amount:29900,currency:'INR'})}}));

  await assert.rejects(
    SubscriptionService.verifyUpgradeCheckoutPayment({
      sessionId: 's1', razorpayOrderId: 'order_other', razorpayPaymentId: 'pay_1', razorpaySignature: 'sig',
    }),
    /Payment verification failed/
  );
  assert.equal(updates.length, 0);
});

test('a payment activates the subscription only once', async () => {
  const { updates } = setupPaymentStubs();

  const first = await SubscriptionService.activatePaidPlan({ userId: 'u1', plan: 'team', razorpayPaymentId: 'pay_2' });
  const second = await SubscriptionService.activatePaidPlan({ userId: 'u1', plan: 'team', razorpayPaymentId: 'pay_2' });

  assert.equal(updates.length, 1);
  assert.equal(first.subscriptionStatus, 'active');
  assert.equal(second.alreadyProcessed, true);
});

test('webhook activation trusts order notes, not payment notes', async (t) => {
  const { updates } = setupPaymentStubs();
  t.mock.method(SubscriptionService, 'getRazorpayClient', () => ({
    orders: {
      fetch: async () => ({
        id: 'order_3',
        amount: 29900,
        currency: 'INR',
        notes: { stitch_upgrade_session_id: 's3', stitch_user_id: 'u3', stitch_plan: 'basic' },
      }),
    },
  }));

  const result = await SubscriptionService.activateFromWebhookPayment({
    id: 'pay_3',
    order_id: 'order_3',
    amount: 29900,
    currency: 'INR',
    status: 'captured',
    notes: { stitch_upgrade_session_id: 's3', stitch_plan: 'annual', stitch_user_id: 'attacker' },
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].userId, 'u3');
  assert.equal(updates[0].plan, 'basic');
  assert.equal(result.plan, 'basic');
});

test('webhook activation ignores amount mismatches and non-subscription orders', async (t) => {
  const { updates } = setupPaymentStubs();
  const orders = {
    order_low: { amount: 100, currency: 'INR', notes: { stitch_upgrade_session_id: 's', stitch_user_id: 'u', stitch_plan: 'pro' } },
    order_customer: { amount: 50000, currency: 'INR', notes: { stitch_order_id: '42' } },
  };
  t.mock.method(SubscriptionService, 'getRazorpayClient', () => ({
    orders: { fetch: async (id) => orders[id] },
  }));

  const mismatch = await SubscriptionService.activateFromWebhookPayment({
    id: 'pay_low', order_id: 'order_low', amount: 100, currency: 'INR', status: 'captured',
  });
  const customer = await SubscriptionService.activateFromWebhookPayment({
    id: 'pay_customer', order_id: 'order_customer', amount: 50000, currency: 'INR', status: 'captured',
  });

  assert.equal(mismatch.ignored, true);
  assert.equal(customer.ignored, true);
  assert.equal(updates.length, 0);
});

test('PUT /user/profile only forwards the name field', async (t) => {
  const UserService = require('../src/services/user.service');
  const userController = require('../src/controllers/user.controller');
  let forwarded;
  t.mock.method(UserService, 'updateUserProfile', async (userId, data) => {
    forwarded = data;
    return { id: userId, ...data };
  });

  const res = { status() { return this; }, json() { return this; } };
  await userController.updateProfile({
    user: { user_id: 'u1' },
    body: {
      name: 'Asha',
      subscription_status: 'active',
      subscription_ends_at: '2099-01-01',
      plan: 'pro',
      shop_id: 'other-shop',
      google_id: 'x',
    },
  }, res);

  assert.deepEqual(forwarded, { name: 'Asha' });
});

test('webhook handler checks the signature and only activates on captured payments', async (t) => {
  const crypto = require('crypto');
  const webhookController = require('../src/controllers/webhook.controller');
  const ledger = require('../src/models/billingLedger');
  t.mock.method(ledger, 'claimWebhook', async () => ({state:'claimed',attempt:1}));
  t.mock.method(ledger, 'finishWebhook', async () => {});
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
  const activate = t.mock.method(SubscriptionService, 'activateFromWebhookPayment', async () => ({
    userId: 'u1', plan: 'basic', subscriptionStatus: 'active',
  }));

  const call = async (body, signature) => {
    const raw = Buffer.from(JSON.stringify(body));
    const sig = signature || crypto.createHmac('sha256', 'whsec_test').update(raw).digest('hex');
    const res = {
      statusCode: 0,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };
    await webhookController.handleRazorpayWebhook({ body: raw, get: () => sig }, res);
    return res;
  };

  const payment = { id: 'pay_1', order_id: 'order_1', amount: 29900, currency: 'INR' };

  assert.equal((await call({ event: 'payment.captured', payload: { payment: { entity: { ...payment, status: 'captured' } } } }, 'bad')).statusCode, 400);
  assert.equal((await call({ event: 'payment.authorized', payload: { payment: { entity: { ...payment, status: 'authorized' } } } })).statusCode, 200);
  assert.equal(activate.mock.callCount(), 0);

  assert.equal((await call({ event: 'payment.captured', payload: { payment: { entity: { ...payment, status: 'captured' } } } })).statusCode, 200);
  assert.equal(activate.mock.callCount(), 1);
});
