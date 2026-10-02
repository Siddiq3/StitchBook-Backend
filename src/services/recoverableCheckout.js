const crypto = require('crypto');
const db = require('../config/database');
const ledger = require('../models/billingLedger');
const cashfree = require('./cashfree');
async function createRecoverableOrder({ id, userId, plan, amount, receipt, customer, returnUrl }) {
  const intent = await ledger.reserveIntent({id,userId,plan,amount,receipt});
  const orderId = intent.provider_order_id || `upgrade_${id}`;
  try {
    let order;
    try { order = await cashfree.getOrder(orderId); }
    catch (error) { if (error.statusCode !== 404) throw error; }
    if (!order) {
      if (intent.attempted) throw new Error('Payment setup is pending reconciliation. Please try again later or contact support.');
      const details = cashfree.customerDetails(userId, customer);
      const claimed = await db.query("UPDATE billing_intents SET attempted=TRUE,state='UNCERTAIN' WHERE id=$1 AND attempted=FALSE RETURNING id", [id]);
      if (!claimed.rowCount) throw new Error('Payment setup is pending reconciliation');
      const hex = crypto.createHash('sha256').update(id).digest('hex');
      const key = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
      order = await cashfree.createOrder({order_id:orderId,order_amount:amount/100,order_currency:'INR',customer_details:details,order_meta:{return_url:returnUrl}},key);
    }
    if (order.order_id !== orderId || Math.round(Number(order.order_amount)*100) !== amount || order.order_currency !== 'INR') throw new Error('Checkout amount mismatch');
    await db.query("UPDATE billing_intents SET provider_order_id=$2,state='READY',lease_until=NULL WHERE id=$1", [id,orderId]);
    return order;
  } catch (error) {
    await db.query("UPDATE billing_intents SET state='UNCERTAIN',lease_until=NULL WHERE id=$1",[id]).catch(()=>{});
    throw error;
  }
}
module.exports = {createRecoverableOrder};
