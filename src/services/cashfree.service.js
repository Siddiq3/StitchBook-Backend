const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

const SANDBOX_BASE = 'https://sandbox.cashfree.com/pg';
const PRODUCTION_BASE = 'https://api.cashfree.com/pg';

const getConfig = () => {
  const appId = String(process.env.CASHFREE_APP_ID || '').trim();
  const secretKey = String(process.env.CASHFREE_SECRET_KEY || '').trim();
  const environment = String(process.env.CASHFREE_ENV || 'sandbox').trim().toLowerCase();
  const apiVersion = String(process.env.CASHFREE_API_VERSION || '2023-08-01').trim();

  if (!appId || !secretKey) {
    const error = new Error('Cashfree credentials are not configured');
    error.code = 'CASHFREE_NOT_CONFIGURED';
    throw error;
  }

  return {
    appId,
    secretKey,
    environment: environment === 'production' ? 'production' : 'sandbox',
    apiVersion,
  };
};

const apiBase = () => getConfig().environment === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;

const call = async (method, path, body) => {
  const { appId, secretKey, apiVersion } = getConfig();
  try {
    const response = await axios({
      method,
      url: `${apiBase()}${path}`,
      data: body,
      timeout: 12000,
      headers: {
        'x-api-version': apiVersion,
        'x-client-id': appId,
        'x-client-secret': secretKey,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    return response.data;
  } catch (error) {
    logger.error('Cashfree request failed', {
      status: error.response?.status || null,
      message: error.response?.data?.message || error.message,
      path,
    });
    const providerError = new Error(
      error.response?.status === 401
        ? 'Cashfree authentication failed'
        : 'The payment provider could not complete this request'
    );
    providerError.statusCode = error.response?.status || 500;
    providerError.code = 'CASHFREE_REQUEST_FAILED';
    throw providerError;
  }
};

const cleanPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return '9999999999';
};

const cleanEmail = (value, id) => {
  const email = String(value || '').trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return email;
  return `customer-${id}@example.com`;
};

exports.createOrder = async ({ orderId, amountPaise, customer = {}, note, tags, returnUrl, notifyUrl }) => {
  const amount = Number((Number(amountPaise) / 100).toFixed(2));
  if (!Number.isFinite(amount) || amount < 1) throw new Error('Payment amount must be at least ₹1');

  const customerId = String(customer.id || orderId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);

  const order = await call('POST', '/orders', {
    order_id: orderId,
    order_amount: amount,
    order_currency: 'INR',
    customer_details: {
      customer_id: customerId,
      customer_name: String(customer.name || 'Customer').slice(0, 100),
      customer_email: cleanEmail(customer.email, customerId),
      customer_phone: cleanPhone(customer.phone),
    },
    ...(note ? { order_note: String(note).slice(0, 180) } : {}),
    ...(tags ? { order_tags: tags } : {}),
    order_meta: {
      ...(returnUrl ? { return_url: returnUrl } : {}),
      ...(notifyUrl || process.env.CASHFREE_NOTIFY_URL ? { notify_url: notifyUrl || process.env.CASHFREE_NOTIFY_URL } : {}),
    },
  });

  if (!order?.payment_session_id) throw new Error('Cashfree did not return a payment session');

  return order;
};

exports.getOrder = async (orderId) => call('GET', `/orders/${encodeURIComponent(orderId)}`);

exports.getOrderPayments = async (orderId) => call('GET', `/orders/${encodeURIComponent(orderId)}/payments`);

exports.isOrderPaid = async (orderId) => {
  const order = await exports.getOrder(orderId);
  return { paid: order?.order_status === 'PAID', order };
};

exports.publicMode = () => getConfig().environment;

exports.verifyWebhookSignature = (rawBody, timestamp, signature) => {
  const { secretKey } = getConfig();
  if (!timestamp || !signature) return false;
  const expected = crypto.createHmac('sha256', secretKey).update(`${timestamp}${rawBody}`).digest('base64');
  const left = Buffer.from(expected);
  const right = Buffer.from(String(signature));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

exports.isWebhookTimestampFresh = (timestamp) => {
  if (!/^\d{10,13}$/.test(String(timestamp || ''))) return false;
  const raw = Number(timestamp);
  const seconds = String(timestamp).length >= 13 ? Math.floor(raw / 1000) : raw;
  const tolerance = Math.max(300, Number(process.env.CASHFREE_WEBHOOK_TOLERANCE_SECONDS || 3600));
  return Math.abs(Math.floor(Date.now() / 1000) - seconds) <= tolerance;
};
