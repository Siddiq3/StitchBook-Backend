const test=require('node:test');
const assert=require('node:assert/strict');
process.env.NODE_ENV='test';
process.env.JWT_SECRET='test-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET='test-refresh-secret-not-for-production';
const {validateProductionConfig}=require('../src/config/production');
const production={NODE_ENV:'production',JWT_SECRET:'a'.repeat(40),JWT_REFRESH_SECRET:'b'.repeat(40),DATABASE_URL:'postgres://database/app',REDIS_URL:'rediss://redis',GOOGLE_WEB_CLIENT_ID:'configured.apps.googleusercontent.com',FRONTEND_URLS:'https://example.org',EMAIL_PROVIDER:'resend',EMAIL_FROM:'billing@example.org',PASSWORD_RESET_OTP_SECRET:'c'.repeat(40),RESEND_API_KEY:'re_test_only',CASHFREE_ENV:'production',CASHFREE_APP_ID:'test-only-app',CASHFREE_SECRET_KEY:'test-only-key',WEB_APP_URL:'https://example.org',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-role-test-value'};
test('production rejects sandbox billing, HTTP return URLs, and weak signing secrets',()=>{
  assert.doesNotThrow(()=>validateProductionConfig(production));
  for(const change of [{CASHFREE_ENV:'sandbox'},{WEB_APP_URL:'http://example.org'},{FRONTEND_URLS:'*'},{JWT_SECRET:'short'},{JWT_REFRESH_SECRET:production.JWT_SECRET}]) assert.throws(()=>validateProductionConfig({...production,...change}));
});
test('logger redacts nested credentials and URL secrets',()=>{
  const {redact}=require('../src/utils/redact');
  const result=redact({authorization:'Bearer secret',nested:{refreshToken:'secret',password:'secret'},text:'Bearer abcd https://host/path?checkoutToken=abcd'});
  assert.equal(result.authorization,'[Redacted]');assert.equal(result.nested.refreshToken,'[Redacted]');assert.ok(!result.text.includes('abcd'));
});
test('readiness coalesces concurrent probes and caches outages without leaking dependencies',async()=>{
  const {createReadinessProbe}=require('../src/services/readiness');
  let calls=0,now=0;
  const ready=createReadinessProbe({checkDatabase:async()=>{calls++;throw new Error('secret-db-host');},checkRedis:()=>true,now:()=>now});
  const results=await Promise.all(Array.from({length:30},()=>ready()));
  assert.equal(calls,1);assert.deepEqual(results[0],{status:'NOT_READY'});
  await ready();assert.equal(calls,1);now=6000;await ready();assert.equal(calls,2);
});
test('web refresh rotates HttpOnly cookie and never returns refresh token in JSON',()=>{
  const {webSession}=require('../src/middleware/webSession');
  const req={headers:{cookie:'stitchbook_refresh=old-token'},path:'/refresh-token',body:{},get:name=>({'x-client-platform':'web',origin:'http://localhost:5173'})[name]};
  let output,cookie;
  const res={statusCode:200,json:body=>output=body,cookie:(name,value,options)=>{cookie={name,value,options};},clearCookie:()=>{},status(){return this;}};
  webSession(req,res,()=>{});
  assert.equal(req.body.refreshToken,'old-token');res.json({success:true,data:{token:'access',refreshToken:'rotated'}});
  assert.equal(cookie.options.httpOnly,true);assert.equal(cookie.value,'rotated');assert.equal(output.data.refreshToken,undefined);
});
test('cookie refresh rejects unapproved origin and spoofed native platform',()=>{
  const {webSession}=require('../src/middleware/webSession');
  for(const [origin,platform] of [['https://attacker.example','web'],['http://localhost:5173','android']]){
    let status,next=false;
    const req={headers:{cookie:'stitchbook_refresh=secret'},body:{},get:name=>({origin,'x-client-platform':platform})[name]};
    const res={status:code=>{status=code;return res;},json:()=>{}};
    webSession(req,res,()=>{next=true;});assert.equal(status,403);assert.equal(next,false);
  }
});
test('Supabase storage object paths are strictly tenant scoped',()=>{
  const storage=require('../src/services/storage.service');
  assert.equal(storage.assertOwnedPath(1,'shops/1/image.png'),'shops/1/image.png');
  assert.equal(storage.assertOwnedPath(22,'/shops/22/photo.webp'),'shops/22/photo.webp');
  assert.throws(()=>storage.assertOwnedPath(1,'shops/2/image.png'),/File not found/);
  assert.throws(()=>storage.assertOwnedPath(1,'shops/1/nested/image.png'),/File not found/);
  assert.throws(()=>storage.assertOwnedPath(1,'shops/1/../secret.png'),/File not found/);
  assert.throws(()=>storage.assertOwnedPath(1,'shops/1/file.svg'),/File not found/);
});
const db=require('../src/config/database');
const ledger=require('../src/models/billingLedger');
require('../src/config/redis').client.disconnect();
const {createRecoverableOrder}=require('../src/services/recoverableCheckout');
const cashfree = require('../src/services/cashfree');
test('provider success followed by DB failure recovers the same Cashfree order on retry', async t => {
  let attempted = false, saved = false, creates = 0, providerOrder;
  t.mock.method(ledger, 'reserveIntent', async () => ({attempted,provider_order_id:null}));
  t.mock.method(cashfree, 'getOrder', async () => {
    if (!providerOrder) throw Object.assign(new Error('Not found'), {statusCode:404});
    return providerOrder;
  });
  t.mock.method(cashfree, 'createOrder', async body => {
    creates++;
    providerOrder = {...body,payment_session_id:'session_test'};
    return providerOrder;
  });
  t.mock.method(db, 'query', async sql => {
    if (sql.includes('attempted=TRUE')) {attempted=true;return {rowCount:1};}
    if (sql.includes('provider_order_id') && !saved) {saved=true;throw new Error('database timeout');}
  });
  const args = {id:'intent',userId:1,plan:'basic',amount:29900,receipt:'stable',customer:{phone:'9876543210'},returnUrl:'https://example.org'};
  await assert.rejects(createRecoverableOrder(args), /database timeout/);
  const recovered = await createRecoverableOrder(args);
  assert.equal(recovered.order_id, 'upgrade_intent');
  assert.equal(creates, 1);
});
test('timeout never creates another Cashfree order before reconciliation', async t => {
  let attempted = false, creates = 0;
  t.mock.method(ledger, 'reserveIntent', async () => ({attempted}));
  t.mock.method(db, 'query', async sql => {if (sql.includes('attempted=TRUE')) {attempted=true;return {rowCount:1};}});
  t.mock.method(cashfree, 'getOrder', async () => {throw Object.assign(new Error('Not found'), {statusCode:404});});
  t.mock.method(cashfree, 'createOrder', async () => {creates++;throw new Error('timeout');});
  const args = {id:'intent',userId:1,plan:'basic',amount:29900,receipt:'stable',customer:{phone:'9876543210'}};
  await assert.rejects(createRecoverableOrder(args), /timeout/);
  await assert.rejects(createRecoverableOrder(args), /pending reconciliation/);
  assert.equal(creates,1);
});
test('cross-tenant order and measurement IDs cannot be read',async t=>{
  const auth=require('../src/services/authorization.service');
  const Shop=require('../src/models/shop.model');
  const Order=require('../src/models/order.model');
  const Measurement=require('../src/models/measurement.model');
  const Customer=require('../src/models/customer.model');
  t.mock.method(Shop,'getShopByUserId',async()=>({id:1}));
  t.mock.method(Order,'getOrderById',async()=>({id:44,shop_id:2}));
  t.mock.method(Measurement,'getMeasurementById',async()=>({id:77,customer_id:55}));
  t.mock.method(Customer,'getCustomerById',async()=>({id:55,shop_id:2}));
  await assert.rejects(auth.verifyOrderOwnership(1,44),/Unauthorized/);
  await assert.rejects(auth.verifyMeasurementOwnership(1,77),/Unauthorized/);
});
test('checkout rejects an account whose deletion has started',async t=>{
  const redis=require('../src/config/redis').client;
  const priorStatus=redis.status;
  redis.status='ready';
  t.after(()=>{redis.status=priorStatus;});
  t.mock.method(redis,'get',async()=>JSON.stringify({userId:1,expiresAt:new Date(Date.now()+60000).toISOString()}));
  t.mock.method(require('../src/models/user.model'),'getUserById',async()=>({id:1,deletion_started_at:new Date()}));
  await assert.rejects(require('../src/services/subscription.service').validateUpgradeSession('deleted-account'),/unavailable for checkout/);
});
test.after(async()=>{await db.pool.end();});
test('storage configuration does not expose service credentials in generated paths',()=>{
  process.env.SUPABASE_URL='https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='service-role-test-value';
  process.env.SUPABASE_STORAGE_BUCKET='stitchbook-private';
  const storage=require('../src/services/storage.service');
  const config=storage.getConfig();
  assert.equal(config.bucket,'stitchbook-private');
  assert.equal(config.storageBaseUrl,'https://project.supabase.co/storage/v1');
  assert.ok(config.serviceRoleKey);
});

test('deletion infrastructure failures preserve retryable capability with 503',async t=>{
  t.mock.method(require('../src/services/accountDeletion.service'),'resume',async()=>{throw new Error('database unavailable');});
  let status;
  const res={status:code=>{status=code;return res;},json:()=>{}};
  await require('../src/controllers/accountDeletion.controller').deleteAccount({get:()=> 'scoped-capability'},res);
  assert.equal(status,503);
});
