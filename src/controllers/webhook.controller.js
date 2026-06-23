const crypto = require('crypto');
const SubscriptionService = require('../services/subscription.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');

const getRazorpayWebhookSecret = () => process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

exports.handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.get('x-razorpay-signature');
    const rawBody = req.body?.toString ? req.body.toString('utf8') : '';
    const secret = getRazorpayWebhookSecret();

    if (!signature || !secret) {
      return responder.error(res, 400, 'Razorpay webhook configuration is incomplete');
    }

    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return responder.error(res, 400, 'Invalid Razorpay webhook signature');
    }

    const payload = JSON.parse(rawBody);
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderEntity = payload?.payload?.order?.entity;
    const paymentStatus = paymentEntity?.status;
    const notes = paymentEntity?.notes || orderEntity?.notes || {};
    const sessionId = notes.stitch_upgrade_session_id;
    const plan = notes.stitch_plan;

    if (!sessionId) {
      return responder.error(res, 400, 'Razorpay webhook missing upgrade session reference');
    }

    if (!['captured', 'authorized', 'paid'].includes(paymentStatus)) {
      logger.info(`Ignoring Razorpay webhook with status: ${paymentStatus}`);
      return responder.success(res, 200, 'Webhook received', { received: true });
    }

    const activation = await SubscriptionService.activateUpgradeFromPayment({ sessionId, plan });
    logger.info(`Subscription activated via Razorpay webhook for user ${activation.userId}`);
    return responder.success(res, 200, 'Subscription activated', activation);
  } catch (error) {
    logger.error('Razorpay webhook error:', error.message);
    responder.error(res, 500, 'Razorpay webhook processing failed', error.message);
  }
};
