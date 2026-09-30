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
    // Compare the hex strings byte-for-byte; decoding only one side would make
    // the lengths differ and reject every genuine webhook.
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(String(signature), 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return responder.error(res, 400, 'Invalid Razorpay webhook signature');
    }

    const payload = JSON.parse(rawBody);
    const event = payload?.event;
    const paymentEntity = payload?.payload?.payment?.entity;

    // Only activate on captured money. Other events (and other Razorpay orders
    // such as customer order payments) are acknowledged so Razorpay stops retrying.
    if (!['payment.captured', 'order.paid'].includes(event) || paymentEntity?.status !== 'captured') {
      logger.info(`Ignoring Razorpay webhook event: ${event} (${paymentEntity?.status})`);
      return responder.success(res, 200, 'Webhook received', { received: true });
    }

    const activation = await SubscriptionService.activateFromWebhookPayment(paymentEntity);
    if (activation.ignored) {
      logger.info(`Ignoring Razorpay webhook payment ${paymentEntity.id}: ${activation.reason}`);
      return responder.success(res, 200, 'Webhook received', { received: true });
    }

    logger.info(`Subscription activated via Razorpay webhook for user ${activation.userId}`);
    return responder.success(res, 200, 'Subscription activated', {
      received: true,
      alreadyProcessed: Boolean(activation.alreadyProcessed),
    });
  } catch (error) {
    logger.error('Razorpay webhook error:', error.message);
    responder.error(res, 500, 'Razorpay webhook processing failed', error.message);
  }
};
