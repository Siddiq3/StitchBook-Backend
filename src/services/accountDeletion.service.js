const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { transaction } = require('../models/billingLedger');
const { JWT_SECRET } = require('../config/env');
const SessionService = require('./session.service');
const UserModel = require('../models/user.model');
const GoogleAuth = require('./googleAuth.service');
const Msg91 = require('./msg91Widget.service');
const StorageService = require('./storage.service');

const shopScope = 'SELECT id FROM shops WHERE user_id=$1';
const orderScope = `SELECT id FROM orders WHERE shop_id IN (${shopScope})`;
const customerScope = `SELECT id FROM customers WHERE shop_id IN (${shopScope})`;
const phases = [
  ['payments', `shop_id IN (${shopScope})`],
  ['activity_log', `shop_id IN (${shopScope})`],
  ['portfolio', `shop_id IN (${shopScope})`],
  ['staff_work_logs', `shop_id IN (${shopScope})`],
  ['invoices', `shop_id IN (${shopScope})`],
  ['gallery', `shop_id IN (${shopScope})`],
  ['notifications', `shop_id IN (${shopScope})`],
  ['order_items', `order_id IN (${orderScope})`],
  ['measurements', `customer_id IN (${customerScope})`],
  ['orders', `shop_id IN (${shopScope})`],
  ['customers', `shop_id IN (${shopScope})`],
  ['staff', `shop_id IN (${shopScope})`],
  ['push_tokens', 'user_id=$1'],
  ['subscriptions', 'user_id=$1'],
  ['billing_intents', 'user_id=$1'],
  ['billing_payment_events', 'user_id=$1'],
  ['orders','assigned_to=$1','assigned_to'],
  ['payments','recorded_by=$1','recorded_by'],
  ['activity_log','user_id=$1','user_id'],
  ['notifications','user_id=$1','user_id'],
  ['staff','user_id=$1','user_id'],
  ['customer_payment_checkouts', "session->>'userId'=$1::text"],
];

async function hasColumn(client, table, column) {
  return (await client.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [table,column])).rowCount > 0;
}
async function verifyIdentity(userId, proof) {
  const user = await UserModel.getUserById(userId);
  if (!user) throw new Error('Account is unavailable');
  if (proof.password) {
    // Email/password accounts (owners and staff) confirm with their current password
    const row = await db.queryRow('SELECT password_hash FROM users WHERE id=$1', [userId]);
    const matches = row?.password_hash && await bcrypt.compare(String(proof.password).slice(0, 128), row.password_hash);
    if (!matches) throw new Error('Password is incorrect');
  } else if (proof.googleIdToken) {
    const identity = await GoogleAuth.verifyIdToken(proof.googleIdToken);
    if (!user.google_id || identity.googleId !== user.google_id || !identity.issuedAt || Date.now()/1000-identity.issuedAt > 300) throw new Error('Please sign in again with the Google account linked to this account');
  } else if (proof.mobileAccessToken) {
    const identity = await Msg91.verifyAccessToken(proof.mobileAccessToken);
    if (!user.phone || identity.mobile !== user.phone) throw new Error('Re-authentication failed');
  } else throw new Error('Please sign in again to confirm account deletion');
}
function makeToken(userId) {
  return jwt.sign({userId,scope:'account-deletion',nonce:crypto.randomBytes(24).toString('hex')}, JWT_SECRET, {expiresIn:'7d',algorithm:'HS256'});
}
function verifyToken(token) {
  const decoded = jwt.verify(token,JWT_SECRET,{algorithms:['HS256']});
  if (decoded.scope !== 'account-deletion' || !decoded.userId) throw new Error('Invalid deletion token');
  return decoded.userId;
}
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const invalidRequest = (message, status=400) => Object.assign(new Error(message), {status});

async function begin(userId, proof, confirmation) {
  if (confirmation !== 'DELETE') throw invalidRequest('Type DELETE to confirm permanent deletion');
  await verifyIdentity(userId, proof).catch(error=>{error.status=400;throw error;});
  const token = makeToken(userId);
  await transaction(async client => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const shops = (await client.query('SELECT id FROM shops WHERE user_id=$1', [userId])).rows.map(row=>row.id);
    await client.query(`INSERT INTO account_deletions(user_id,token_hash,shop_ids) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET token_hash=$2,updated_at=NOW()`, [userId,hash(token),JSON.stringify(shops)]);
    await client.query('UPDATE users SET deletion_started_at=COALESCE(deletion_started_at,NOW()) WHERE id=$1',[userId]);
  });
  return {deletionToken:token, state:'IN_PROGRESS',complete:false};
}

async function resume(token) {
  const userId = verifyToken(token);
  const job = await db.queryRow('SELECT * FROM account_deletions WHERE user_id=$1',[userId]);
  if (!job) {
    if (await UserModel.getUserById(userId)) throw invalidRequest('Deletion request is not active');
    return {complete:true,state:'COMPLETE'};
  }
  if (job.token_hash !== hash(token)) throw invalidRequest('Deletion token was replaced. Please re-authenticate',401);
  if (Number(job.phase) === 0) {
    await db.query('UPDATE account_deletions SET phase=1,updated_at=NOW() WHERE user_id=$1 AND phase=0',[userId]);
    return {complete:false,state:'IN_PROGRESS'};
  }
  const phase = Number(job.phase)-1;
  if (phase < phases.length) {
    return transaction(async client => {
      const locked = (await client.query('SELECT phase FROM account_deletions WHERE user_id=$1 FOR UPDATE',[userId])).rows[0];
      if (!locked || Number(locked.phase) !== Number(job.phase)) return {complete:false,state:'IN_PROGRESS'};
      const [table,scope,pointer] = phases[phase];
      const exists = (await client.query('SELECT to_regclass($1) AS name',[`public.${table}`])).rows[0]?.name;
      const available = exists && (!pointer || await hasColumn(client,table,pointer));
      const deleted = available ? await client.query(`${pointer ? `UPDATE ${table} SET ${pointer}=NULL` : `DELETE FROM ${table}`} WHERE ctid IN (SELECT ctid FROM ${table} WHERE ${scope} LIMIT 100)`,[userId]) : {rowCount:0};
      if (deleted.rowCount < 100) await client.query('UPDATE account_deletions SET phase=phase+1,updated_at=NOW() WHERE user_id=$1',[userId]);
      return {complete:false,state:'IN_PROGRESS'};
    });
  }
  const filesComplete = await StorageService.deleteShopFiles(job.shop_ids || [], 100);
  if (!filesComplete) return {complete:false,state:'IN_PROGRESS'};
  const sessions=await SessionService.revokeSessionBatch(userId);
  if(sessions.remaining) return {complete:false,state:'IN_PROGRESS'};
  await transaction(async client => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
    if (await hasColumn(client,'users','shop_id')) await client.query(`UPDATE users SET shop_id=NULL WHERE shop_id IN (${shopScope})`,[userId]);
    await client.query('DELETE FROM shops WHERE user_id=$1',[userId]);
    await client.query('DELETE FROM users WHERE id=$1',[userId]);
  });
  return {complete:true,state:'COMPLETE'};
}

module.exports = { begin, resume, verifyToken, phases };
