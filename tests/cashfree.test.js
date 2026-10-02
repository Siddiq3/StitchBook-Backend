const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const cashfree = require('../src/services/cashfree');
test('only paid orders and matching SUCCESS payment amounts are accepted', async t => {
  let order={order_id:'order_1',order_status:'PAID',order_amount:299,order_currency:'INR'};
  let payment={cf_payment_id:123,payment_status:'SUCCESS',payment_amount:299,payment_currency:'INR'};
  t.mock.method(cashfree,'getOrder',async()=>order);
  t.mock.method(cashfree,'getPayments',async()=>[payment]);
  assert.equal((await cashfree.verifiedPayment('order_1',299)).cf_payment_id,123);
  for (const change of [{order_status:'ACTIVE'},{order_amount:1},{order_currency:'USD'},{order_id:'other'}]) {
    const original=order;order={...order,...change};
    await assert.rejects(cashfree.verifiedPayment('order_1',299),/not successful/);order=original;
  }
  for (const change of [{payment_status:'PENDING'},{payment_status:'FAILED'},{payment_amount:1},{payment_currency:'USD'}]) {
    const original=payment;payment={...payment,...change};
    await assert.rejects(cashfree.verifiedPayment('order_1',299),/not successful/);payment=original;
  }
});
test('webhook rejects body tampering and timestamp tampering', () => {
  process.env.CASHFREE_SECRET_KEY='test-secret';
  const raw=Buffer.from('{"amount":299.00}');
  const timestamp='1700000000';
  const sig=crypto.createHmac('sha256','test-secret').update(timestamp).update(raw).digest('base64');
  assert.equal(cashfree.verifyWebhook(raw,sig,timestamp),true);
  assert.equal(cashfree.verifyWebhook(Buffer.from('{"amount":299}'),sig,timestamp),false);
  assert.equal(cashfree.verifyWebhook(raw,sig,'1700000001'),false);
  assert.equal(cashfree.verifyWebhook({},sig,timestamp),false);
});
test('customer phone is required and Indian country prefix is normalized', () => {
  assert.equal(cashfree.customerDetails('u',{phone:'+91 98765 43210'}).customer_phone,'9876543210');
  assert.throws(()=>cashfree.customerDetails('u',{phone:''}),/mobile number/);
});
