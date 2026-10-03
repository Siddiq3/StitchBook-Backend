const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const enabled=Boolean(process.env.TEST_DATABASE_URL);
if(enabled){
  const url=new URL(process.env.TEST_DATABASE_URL);
  assert.ok(
    ['127.0.0.1','localhost'].includes(url.hostname) && url.pathname.startsWith('/stitchbook_test'),
    'Integration tests require an isolated local stitchbook_test database'
  );
  process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
}

process.env.NODE_ENV='test';
process.env.JWT_SECRET='test-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET='test-refresh-secret-not-for-production';

const db=require('../src/config/database');
const ledger=require('../src/models/billingLedger');
const redis=require('../src/config/redis').client;
redis.disconnect();
const integration=(name,callback)=>test(name,{skip:!enabled},callback);

test.before(async()=>{
  if(!enabled)return;
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await db.query(fs.readFileSync(path.join(__dirname,'../migrations/001_initial_schema.sql'),'utf8'));
  await db.query(`
    INSERT INTO users(google_id,name) VALUES('identity-1','Owner'),('identity-2','Other owner');
    INSERT INTO shops(user_id,name,phone) VALUES(1,'Shop 1','+919000000001'),(2,'Shop 2','+919000000002');
    UPDATE users SET shop_id=id WHERE id IN (1,2);
    INSERT INTO customers(shop_id,name,phone) VALUES(1,'Customer 1','+918000000001'),(2,'Customer 2','+918000000002');
    INSERT INTO orders(customer_id,shop_id,total_amount,balance_due)
      VALUES(1,1,1000,1000),(2,2,1000,1000);
  `);
});

integration('baseline exposes provider-neutral Cashfree columns',async()=>{
  const columns=await db.queryAll(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name='subscriptions'
      AND column_name IN ('provider_payment_id','provider_order_id')
    ORDER BY column_name
  `);
  assert.deepEqual(columns.map(row=>row.column_name),['provider_order_id','provider_payment_id']);
  await db.query(`
    INSERT INTO customer_payment_checkouts(provider_order_id,session)
    VALUES('customer_test','{"userId":1}'),('customer_other','{"userId":2}')
  `);
});

integration('concurrent identical captured payment activates only once',async()=>{
  const results=await Promise.all(Array.from({length:10},()=>ledger.applyPayment({userId:1,plan:'basic',paymentId:'same-payment',durationDays:30})));
  assert.equal(results.filter(result=>!result.alreadyProcessed).length,1);
  assert.equal(Number((await db.queryRow('SELECT COUNT(*) AS count FROM billing_payment_events')).count),1);
  await assert.rejects(ledger.applyPayment({userId:2,plan:'basic',paymentId:'same-payment',durationDays:30}),/ownership/);
});

integration('DB failure rolls back payment marker and permits retry',async()=>{
  await db.query(`CREATE FUNCTION fail_activation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected persistence failure'; END $$; CREATE TRIGGER reject_activation BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fail_activation();`);
  await assert.rejects(ledger.applyPayment({userId:1,plan:'pro',paymentId:'retry-payment',durationDays:30}),/injected persistence/);
  assert.equal(await db.queryRow("SELECT * FROM billing_payment_events WHERE payment_id='retry-payment'"),null);
  await db.query('DROP TRIGGER reject_activation ON users; DROP FUNCTION fail_activation();');
  assert.equal((await ledger.applyPayment({userId:1,plan:'pro',paymentId:'retry-payment',durationDays:30})).subscriptionStatus,'active');
});

integration('duplicate checkout requests share one processing lease',async()=>{
  const input={id:'checkout',userId:1,plan:'basic',amount:29900,receipt:'stable-receipt'};
  const outcomes=await Promise.allSettled([ledger.reserveIntent(input),ledger.reserveIntent(input)]);
  assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);
  await db.query("UPDATE billing_intents SET provider_order_id='order_existing',state='READY' WHERE id='checkout'");
  assert.equal((await ledger.reserveIntent(input)).provider_order_id,'order_existing');
});

integration('concurrent webhook, failed processing retry, lease recovery, and successful duplicate',async()=>{
  const claims=await Promise.all([ledger.claimWebhook('event1'),ledger.claimWebhook('event1')]);
  assert.equal(claims.filter(claim=>claim.state==='claimed').length,1);
  assert.equal(claims.filter(claim=>claim.state==='busy').length,1);
  await ledger.finishWebhook('event1',false,1);
  assert.equal((await ledger.claimWebhook('event1')).state,'claimed');
  await db.query("UPDATE webhook_events SET lease_until=NOW()-INTERVAL '1 minute' WHERE id='event1'");
  assert.equal((await ledger.claimWebhook('event1')).state,'claimed');
  await ledger.finishWebhook('event1',false,1);
  assert.equal((await db.queryRow("SELECT state FROM webhook_events WHERE id='event1'")).state,'PROCESSING');
  await ledger.finishWebhook('event1',true,3);
  assert.equal((await ledger.claimWebhook('event1')).state,'processed');
});

integration('simultaneous order payments retain both entries and correct balance',async()=>{
  const service=require('../src/services/payment.service');
  await Promise.all([service.createPayment(1,1,100,'cash',null,1,null),service.createPayment(1,1,200,'cash',null,1,null)]);
  const order=await db.queryRow('SELECT * FROM orders WHERE id=1');
  assert.equal(Number(order.advance_paid),300);
  assert.equal(Number(order.balance_due),700);
  const repeated=await Promise.all([
    service.createPayment(1,1,50,'online',null,1,null,'unique-provider'),
    service.createPayment(1,1,50,'online',null,1,null,'unique-provider')
  ]);
  assert.equal(repeated[0].id,repeated[1].id);
  assert.equal(Number((await db.queryRow('SELECT advance_paid FROM orders WHERE id=1')).advance_paid),350);
});

integration('deletion rejects wrong identity, resumes bounded batches, and preserves another tenant',async t=>{
  const deletion=require('../src/services/accountDeletion.service');
  const google=require('../src/services/googleAuth.service');
  const sessions=require('../src/services/session.service');
  const storage=require('../src/services/storage.service');
  t.mock.method(google,'verifyIdToken',async token=>({googleId:token,issuedAt:Date.now()/1000}));
  t.mock.method(sessions,'revokeSessionBatch',async()=>({remaining:0}));
  t.mock.method(storage,'deleteShopFiles',async()=>true);

  await assert.rejects(deletion.begin(1,{googleIdToken:'identity-2'},'DELETE'),/linked/);
  await assert.rejects(deletion.begin(1,{googleIdToken:'identity-1'},'wrong'),/DELETE/);
  await db.query('INSERT INTO measurements(customer_id,measurements_data) SELECT 1,\'{}\'::jsonb FROM generate_series(1,251); INSERT INTO measurements(customer_id,measurements_data) VALUES(2,\'{}\'::jsonb);');

  const started=await deletion.begin(1,{googleIdToken:'identity-1'},'DELETE');
  assert.ok((await db.queryRow('SELECT deletion_started_at FROM users WHERE id=1')).deletion_started_at);
  await assert.rejects(ledger.applyPayment({userId:1,plan:'basic',paymentId:'blocked-during-deletion',durationDays:30}),/unavailable/);

  let complete=false,requests=0;
  while(!complete&&requests<60){
    complete=(await deletion.resume(started.deletionToken)).complete;
    requests++;
  }

  assert.equal(complete,true);
  assert.ok(requests>20);
  assert.equal(await db.queryRow('SELECT id FROM users WHERE id=1'),null);
  assert.ok(await db.queryRow('SELECT id FROM users WHERE id=2'));
  assert.equal(await db.queryRow("SELECT * FROM customer_payment_checkouts WHERE provider_order_id='customer_test'"),null);
  assert.ok(await db.queryRow("SELECT * FROM customer_payment_checkouts WHERE provider_order_id='customer_other'"));
  assert.equal(Number((await db.queryRow('SELECT COUNT(*) AS count FROM measurements WHERE customer_id=2')).count),1);
  assert.equal((await deletion.resume(started.deletionToken)).complete,true);
});

test.after(async()=>{await db.pool.end();});
