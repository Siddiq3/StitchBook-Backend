const db = require('../config/database');
async function transaction(work) {
  const client = await db.pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function reserveIntent({ id, userId, plan, amount, receipt }) {
  await db.query(`INSERT INTO billing_intents(id,user_id,plan,amount,receipt) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [id,userId,plan,amount,receipt]);
  const intent = await db.queryRow('SELECT * FROM billing_intents WHERE id=$1', [id]);
  if (!intent || String(intent.user_id) !== String(userId) || intent.plan !== plan || Number(intent.amount) !== amount) throw new Error('Checkout intent mismatch');
  if (intent.provider_order_id) return { ...intent, claimed: false };
  const claimed = await db.queryRow(`UPDATE billing_intents SET state='PROCESSING',lease_until=NOW()+INTERVAL '45 seconds' WHERE id=$1 AND (lease_until IS NULL OR lease_until<NOW()) RETURNING *`, [id]);
  if (!claimed) throw new Error('Checkout is already processing. Please try again shortly.');
  return { ...claimed, claimed:true };
}
async function applyPayment({ userId, plan, paymentId, durationDays }) {
  return transaction(async client => {
    const user = (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [userId])).rows[0];
    if (!user || user.deletion_started_at) throw new Error('Account is unavailable');
    const previous = (await client.query('SELECT * FROM billing_payment_events WHERE payment_id=$1', [paymentId])).rows[0];
    if (previous) {
      if (String(previous.user_id) !== String(userId) || previous.plan !== plan) throw new Error('Payment ownership mismatch');
      return { userId, plan:user.plan, subscriptionStatus:user.subscription_status, subscriptionEndsAt:user.subscription_ends_at, alreadyProcessed:true };
    }
    await client.query('INSERT INTO billing_payment_events(payment_id,user_id,plan) VALUES($1,$2,$3)', [paymentId,userId,plan]);
    const updated = (await client.query(`UPDATE users SET plan=$2,subscription_status='active',subscription_start_at=NOW(),subscription_ends_at=NOW()+($3*INTERVAL '1 day'),updated_at=NOW() WHERE id=$1 RETURNING *`, [userId,plan,durationDays])).rows[0];
    return { userId, plan, subscriptionStatus:'active', subscriptionEndsAt:updated.subscription_ends_at };
  });
}
async function claimWebhook(id) {
  await db.query('INSERT INTO webhook_events(id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
  const row = await db.queryRow(`UPDATE webhook_events SET state='PROCESSING',lease_until=NOW()+INTERVAL '45 seconds',attempts=attempts+1,updated_at=NOW() WHERE id=$1 AND state!='PROCESSED' AND (state!='PROCESSING' OR lease_until<NOW()) RETURNING id,attempts`, [id]);
  if (row) return {state:'claimed',attempt:row.attempts};
  const event = await db.queryRow('SELECT state FROM webhook_events WHERE id=$1', [id]);
  return {state:event?.state === 'PROCESSED' ? 'processed' : 'busy'};
}
async function finishWebhook(id, succeeded, attempt) {
  await db.query(`UPDATE webhook_events SET state=$2,lease_until=NULL,updated_at=NOW() WHERE id=$1 AND attempts=$3 AND state='PROCESSING'`, [id,succeeded?'PROCESSED':'FAILED',attempt]);
}
module.exports = { transaction, reserveIntent, applyPayment, claimWebhook, finishWebhook };
