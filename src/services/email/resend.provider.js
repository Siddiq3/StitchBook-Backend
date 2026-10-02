const axios = require('axios');
const logger = require('../../utils/logger');

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

const getConfig = () => {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim();
  if (!apiKey || !from) {
    const error = new Error('Email delivery is not configured');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  return { apiKey, from };
};

exports.send = async ({ to, subject, html, text, tags, idempotencyKey }) => {
  const { apiKey, from } = getConfig();
  try {
    const response = await axios.post(
      RESEND_EMAILS_URL,
      {
        from,
        to: [to],
        subject,
        html,
        text,
        ...(tags?.length ? { tags } : {}),
      },
      {
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
      }
    );
    return response.data;
  } catch (error) {
    logger.error('Resend email delivery failed', {
      status: error.response?.status || null,
      code: error.code || null,
    });
    const deliveryError = new Error('Unable to send email right now');
    deliveryError.code = 'EMAIL_DELIVERY_FAILED';
    throw deliveryError;
  }
};
