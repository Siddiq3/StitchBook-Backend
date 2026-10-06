/**
 * In-app notifications for shop events. Best effort: a failed notification must
 * never fail the action that triggered it.
 */
const db = require('../config/database');
const NotificationModel = require('../models/notification.model');
const logger = require('../utils/logger');

const ownerUserId = async (shopId) =>
  (await db.queryRow('SELECT user_id FROM shops WHERE id = $1', [shopId]))?.user_id || null;

const staffUserId = async (shopId, staffId) =>
  (await db.queryRow('SELECT user_id FROM staff WHERE id = $1 AND shop_id = $2 AND is_active = true', [staffId, shopId]))?.user_id || null;

async function send({ shopId, userId, title, message, type, data = {} }) {
  if (!shopId || !userId) return;
  try {
    await NotificationModel.createNotification({ shop_id: shopId, user_id: userId, title, message, type, data });
  } catch (error) {
    logger.warn('Notification not created:', error.message);
  }
}

module.exports = {
  // Tell the shop owner
  async owner(shopId, payload) {
    await send({ shopId, userId: await ownerUserId(shopId).catch(() => null), ...payload });
  },
  // Tell one staff member (only if they are active staff of this shop)
  async staff(shopId, staffId, payload) {
    await send({ shopId, userId: await staffUserId(shopId, staffId).catch(() => null), ...payload });
  },
};
