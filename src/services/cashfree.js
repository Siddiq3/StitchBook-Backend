const axios = require('axios');
const crypto = require('crypto');

function getMode() {
  const mode = process.env.CASHFREE_ENV || 'sandbox';
  if (!['sandbox', 'production'].includes(mode)) throw new Error('Invalid CASHFREE_ENV');
  if (process.env.NODE_ENV === 'production' && mode !== 'production') throw new Error('Production billing requires Cashfree production mode');
  return mode;
}
async function request(method, path, data, idempotencyKey) {
  if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) throw new Error('Cashfree credentials are not configured');
  const base = getMode() === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  try {
    const result = await axios({method, url: `${base}${path}`, data, timeout: 15000, headers: {
      'x-client-id': process.env.CASHFREE_APP_ID,
      'x-client-secret': process.env.CASHFREE_SECRET_KEY,
      'x-api-version': process.env.CASHFREE_API_VERSION || '2025-01-01',
      'Content-Type': 'application/json',
      ...(idempotencyKey ? {'x-idempotency-key': idempotencyKey} : {}),
    }});
    return result.data;
  } catch (error) {
    const normalized = new Error(error.response?.data?.message || 'Cashfree request failed. Please try again.');
    normalized.statusCode = error.response?.status || 503;
    throw normalized;
  }
}
function customerDetails(id, customer = {}) {
  let phone = String(customer.phone || '').replace(/\D/g, '');
  if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
  if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('A valid Indian customer mobile number is required for Cashfree checkout');
  return {customer_id: String(id), customer_phone: phone,
    ...(customer.name ? {customer_name: customer.name} : {}),
    ...(customer.email ? {customer_email: customer.email} : {})};
}
async function verifiedPayment(orderId, amount) {
  const order = await module.exports.getOrder(orderId);
  if (order.order_id !== orderId || order.order_status !== 'PAID' || order.order_currency !== 'INR' || Math.round(Number(order.order_amount)*100) !== Math.round(Number(amount)*100)) {
    throw new Error('Payment is not successful or amount does not match');
  }
  const payments = await module.exports.getPayments(orderId);
  const payment = payments.find(item => item.payment_status === 'SUCCESS' && item.payment_currency === 'INR' && Math.round(Number(item.payment_amount)*100) === Math.round(Number(amount)*100) && item.cf_payment_id);
  if (!payment) throw new Error('Payment is not successful or amount does not match');
  return payment;
}
function verifyWebhook(raw, signature, timestamp) {
  if (!Buffer.isBuffer(raw) || !signature || !timestamp || !process.env.CASHFREE_SECRET_KEY) return false;
  const expected = crypto.createHmac('sha256', process.env.CASHFREE_SECRET_KEY).update(String(timestamp)).update(raw).digest('base64');
  const received = Buffer.from(String(signature));
  const buffer = Buffer.from(expected);
  return buffer.length === received.length && crypto.timingSafeEqual(buffer, received);
}
module.exports = {getMode, customerDetails, verifiedPayment, verifyWebhook,
  createOrder: (body, key) => request('POST', '/orders', body, key),
  getOrder: id => request('GET', `/orders/${encodeURIComponent(id)}`),
  getPayments: id => request('GET', `/orders/${encodeURIComponent(id)}/payments`),
};
