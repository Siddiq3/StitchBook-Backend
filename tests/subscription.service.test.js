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
// Payment activation hardening. Redis, the users table and Cashfree are stubbed.
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

const cashfree = require('../src/services/cashfree');
const db = require('../src/config/database');
test('checkout verification activates only the server session plan and is idempotent', async t => {
  const {updates} = setupPaymentStubs();
  t.mock.method(SubscriptionService,'validateUpgradeSession',async()=>({userId:'u1',plan:'basic',amount:299,cashfreeOrderId:'upgrade_s1'}));
  t.mock.method(cashfree,'verifiedPayment',async(id,amount)=>{assert.equal(id,'upgrade_s1');assert.equal(amount,299);return {cf_payment_id:'1'};});
  const request={sessionId:'s1',cashfreeOrderId:'upgrade_s1',plan:'annual'};
  const result=await SubscriptionService.verifyUpgradeCheckoutPayment(request);
  const retry=await SubscriptionService.verifyUpgradeCheckoutPayment(request);
  assert.equal(updates.length,1);assert.equal(result.plan,'basic');assert.equal(retry.alreadyProcessed,true);
});
test('checkout rejects a foreign order before calling Cashfree', async t => {
  setupPaymentStubs();
  t.mock.method(SubscriptionService,'validateUpgradeSession',async()=>({userId:'u1',plan:'basic',amount:299,cashfreeOrderId:'upgrade_s1'}));
  const verify=t.mock.method(cashfree,'verifiedPayment',async()=>({cf_payment_id:'1'}));
  await assert.rejects(SubscriptionService.verifyUpgradeCheckoutPayment({sessionId:'s1',cashfreeOrderId:'foreign'}),/Payment verification failed/);
  assert.equal(verify.mock.callCount(),0);
});
test('webhook activates persisted ownership after checkout session expiry', async t => {
  const {updates}=setupPaymentStubs();
  t.mock.method(db,'queryRow',async()=>({user_id:'u3',plan:'basic',amount:29900}));
  t.mock.method(cashfree,'verifiedPayment',async()=>({cf_payment_id:'3'}));
  await SubscriptionService.activateFromWebhookPayment({orderId:'upgrade_s3',paymentId:'3',plan:'pro',userId:'attacker'});
  assert.equal(updates[0].userId,'u3');assert.equal(updates[0].plan,'basic');
});
test('webhook rejects payment reference mismatch and ignores unknown checkout', async t => {
  const {updates}=setupPaymentStubs();
  t.mock.method(db,'queryRow',async(sql,[id])=>id==='upgrade_known'?{user_id:'u',plan:'basic',amount:29900}:null);
  t.mock.method(cashfree,'verifiedPayment',async()=>({cf_payment_id:'expected'}));
  await assert.rejects(SubscriptionService.activateFromWebhookPayment({orderId:'upgrade_known',paymentId:'foreign'}),/reference mismatch/);
  assert.equal((await SubscriptionService.activateFromWebhookPayment({orderId:'unknown',paymentId:'1'})).ignored,true);
  assert.equal(updates.length,0);
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

test('Cashfree webhook verifies raw body and timestamp and ignores failed payments', async t => {
  const crypto=require('crypto');
  const controller=require('../src/controllers/webhook.controller');
  const ledger=require('../src/models/billingLedger');
  t.mock.method(ledger,'claimWebhook',async()=>({state:'claimed',attempt:1}));
  t.mock.method(ledger,'finishWebhook',async()=>{});
  process.env.CASHFREE_SECRET_KEY='test-only-secret';
  const activate=t.mock.method(SubscriptionService,'activateFromWebhookPayment',async()=>({userId:'u1'}));
  const call=async(status,signature,timestamp='1700000000')=>{
    const raw=Buffer.from(JSON.stringify({type:'PAYMENT_SUCCESS_WEBHOOK',data:{order:{order_id:'upgrade_s1'},payment:{cf_payment_id:'1',payment_status:status}}}));
    const sig=signature||crypto.createHmac('sha256','test-only-secret').update(timestamp).update(raw).digest('base64');
    const res={status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
    await controller.handleCashfreeWebhook({body:raw,get:header=>header==='x-webhook-signature'?sig:timestamp},res);
    return res;
  };
  assert.equal((await call('SUCCESS','bad')).statusCode,400);
  assert.equal((await call('FAILED')).statusCode,200);
  assert.equal(activate.mock.callCount(),0);
  assert.equal((await call('SUCCESS')).statusCode,200);
  assert.equal(activate.mock.callCount(),1);
});


test('webhook verifies the persisted charged amount after the catalog price changes', async t => {
  setupPaymentStubs();
  t.mock.method(db, 'queryRow', async () => ({ user_id:'u1', plan:'basic', amount:24950 }));
  t.mock.method(cashfree, 'verifiedPayment', async (orderId, amount) => {
    assert.equal(amount, 249.5);
    return { cf_payment_id:'old-price-payment' };
  });
  await SubscriptionService.activateFromWebhookPayment({orderId:'upgrade_old',paymentId:'old-price-payment'});
});

test('checkout uses its stored quote instead of the latest catalog price', async t => {
  setupPaymentStubs();
  t.mock.method(SubscriptionService, 'validateUpgradeSession', async () => ({ userId:'u1',plan:'basic',amount:249.5,cashfreeOrderId:'upgrade_old' }));
  t.mock.method(cashfree, 'verifiedPayment', async (id, amount) => {
    assert.equal(amount,249.5);
    return {cf_payment_id:'old-price-checkout'};
  });
  await SubscriptionService.verifyUpgradeCheckoutPayment({sessionId:'old',cashfreeOrderId:'upgrade_old'});
});

test('persisted intent survives price changes and cannot change owner or plan', async t => {
  t.mock.method(db,'queryRow',async()=>({user_id:'u1',plan:'basic',amount:24950}));
  assert.equal(await SubscriptionService.getCheckoutAmount({sessionId:'old',userId:'u1',plan:'basic',amount:299}),249.5);
  await assert.rejects(SubscriptionService.getCheckoutAmount({sessionId:'old',userId:'other',plan:'basic'}),/mismatch/);
  await assert.rejects(SubscriptionService.getCheckoutAmount({sessionId:'old',userId:'u1',plan:'pro'}),/mismatch/);
});

test('public catalog exposes only the three active INR monthly plans', () => {
  assert.deepEqual(SubscriptionService.getPublicPlans().map(({key,currency,duration})=>({key,currency,duration})), ['basic','team','pro'].map(key=>({key,currency:'INR',duration:'month'})));
});

test('new upgrade session snapshots its price before a catalog change', async t => {
  setupPaymentStubs();
  const store = new Map();
  t.mock.method(redisClient, 'setex', async (key, ttl, value) => { store.set(key,value); });
  t.mock.method(redisClient, 'get', async key => store.get(key));
  t.mock.method(db, 'queryRow', async () => null);
  const quote = await SubscriptionService.createUpgradeSession('u1','basic');
  t.mock.method(SubscriptionService, 'getPlanConfig', () => ({amount:799}));
  const session = await SubscriptionService.validateUpgradeSession(quote.sessionId);
  assert.equal(session.amount,299);
  assert.equal(session.currency,'INR');
});
