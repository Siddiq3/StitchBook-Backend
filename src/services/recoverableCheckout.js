const db = require('../config/database');
const ledger = require('../models/billingLedger');
async function createRecoverableOrder({ id, userId, plan, amount, receipt, notes, razorpay }) {
  const intent = await ledger.reserveIntent({ id,userId,plan,amount,receipt });
  if (intent.provider_order_id) return {id:intent.provider_order_id};
  try {
    // Receipt filtering is bounded and reconciles a prior uncertain provider call.
    const found = await razorpay.orders.all({ receipt, count:2 });
    const matches = (found.items || []).filter(order => order.receipt === receipt);
    if (matches.length > 1) throw new Error('Checkout needs reconciliation. Please contact support.');
    let order = matches[0];
    if (!order) {
      if (intent.attempted) throw new Error('Payment setup is pending reconciliation. Please try again later or contact support.');
      // Persist before crossing the provider boundary. A timeout never generates a new order.
      const claimed = await db.query('UPDATE billing_intents SET attempted=TRUE,state=\'UNCERTAIN\' WHERE id=$1 AND attempted=FALSE RETURNING id', [id]);
      if (!claimed.rowCount) throw new Error('Payment setup is pending reconciliation');
      order = await razorpay.orders.create({amount,currency:'INR',receipt,notes});
    }
    if (Number(order.amount) !== amount || order.currency !== 'INR') throw new Error('Checkout amount mismatch');
    await db.query(`UPDATE billing_intents SET provider_order_id=$2,state='READY',lease_until=NULL WHERE id=$1`, [id,order.id]);
    return order;
  } catch (error) {
    await db.query(`UPDATE billing_intents SET state='UNCERTAIN',lease_until=NULL WHERE id=$1`, [id]).catch(()=>{});
    throw error;
  }
}
module.exports = { createRecoverableOrder };
