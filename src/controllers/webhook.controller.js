const crypto = require('crypto');
const cashfree = require('../services/cashfree');
const SubscriptionService = require('../services/subscription.service');
const PaymentService = require('../services/payment.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');
const ledger = require('../models/billingLedger');

exports.handleCashfreeWebhook = async (req,res) => {
  let eventId, claimed = false, attempt;
  try {
    if (!cashfree.verifyWebhook(req.body,req.get('x-webhook-signature'),req.get('x-webhook-timestamp'))) {
      return responder.error(res,400,'Invalid Cashfree webhook signature');
    }
    const payload = JSON.parse(req.body.toString('utf8'));
    if (payload.type !== 'PAYMENT_SUCCESS_WEBHOOK' || payload.data?.payment?.payment_status !== 'SUCCESS') {
      return responder.success(res,200,'Webhook received',{received:true});
    }
    const orderId = payload.data?.order?.order_id;
    const paymentId = payload.data?.payment?.cf_payment_id;
    if (!orderId || !paymentId) return responder.error(res,400,'Missing payment reference');
    eventId = crypto.createHash('sha256').update(`cashfree:${orderId}:${paymentId}`).digest('hex');
    const claim = await ledger.claimWebhook(eventId);
    if (claim.state === 'processed') return responder.success(res,200,'Webhook already received',{received:true,alreadyProcessed:true});
    if (claim.state === 'busy') return responder.error(res,503,'Webhook processing is in progress');
    claimed = true; attempt = claim.attempt;
    const result = orderId.startsWith('customer_')
      ? await PaymentService.recordFromWebhook({orderId,paymentId})
      : await SubscriptionService.activateFromWebhookPayment({orderId,paymentId});
    await ledger.finishWebhook(eventId,true,attempt); claimed = false;
    return responder.success(res,200,'Webhook received',{received:true,alreadyProcessed:Boolean(result.alreadyProcessed)});
  } catch (error) {
    if (claimed) await ledger.finishWebhook(eventId,false,attempt).catch(()=>{});
    logger.error('Cashfree webhook error:',error.message);
    return responder.error(res,500,'Cashfree webhook processing failed');
  }
};
