const db = require("../config/database");
const SubscriptionService = require("./subscription.service");
const limits = { customers: "maxCustomers", orders: "maxOrders" };
async function create(actor, shopId, resource, work) {
  if (!limits[resource]) throw new Error("Unknown quota resource");
  return db.transaction(async () => {
    // Every customer/order creation for this shop takes this lock; the count
    // and insert use the same transaction, including unlimited paid plans.
    await db.query("SELECT id FROM shops WHERE id=$1 FOR UPDATE", [shopId]);
    const subscription = await SubscriptionService.getSubscriptionForActor(
      actor
    );
    if (!subscription?.canUseApp) {
      const error = new Error("Your StitchBook plan is not active.");
      error.status = 402;
      error.code = "SUBSCRIPTION_REQUIRED";
      throw error;
    }
    const max = Number(subscription.features?.[limits[resource]] ?? 0);
    if (max !== -1) {
      const row = await db.queryRow(
        `SELECT COUNT(*)::int AS count FROM ${resource} WHERE shop_id=$1`,
        [shopId]
      );
      if (Number(row.count) >= max) {
        const error = new Error(`Your current plan allows ${max} ${resource}.`);
        error.status = 402;
        error.code = "PLAN_LIMIT_REACHED";
        error.details = {
          resource,
          limit: max,
          current: Number(row.count),
          planType: subscription.planType,
        };
        throw error;
      }
    }
    return work();
  });
}
async function changeStaff(actor, shopId, staffId, active, work) {
  return db.transaction(async () => {
    await db.query("SELECT id FROM shops WHERE id=$1 FOR UPDATE", [shopId]);
    const existing = staffId
      ? await db.queryRow(
          "SELECT is_active FROM staff WHERE id=$1 AND shop_id=$2",
          [staffId, shopId]
        )
      : null;
    const activating = staffId
      ? active === true && !existing?.is_active
      : active !== false;
    if (activating) {
      const subscription = await SubscriptionService.getSubscriptionForActor(
        actor
      );
      const max = Number(subscription?.features?.maxStaff ?? 0);
      if (!subscription?.canUseApp) {
        const error = new Error("Your StitchBook plan is not active.");
        error.status = 402;
        error.code = "SUBSCRIPTION_REQUIRED";
        throw error;
      }
      const row = await db.queryRow(
        "SELECT COUNT(*)::int AS count FROM staff WHERE shop_id=$1 AND is_active=true",
        [shopId]
      );
      if (max !== -1 && Number(row.count) >= max) {
        const error = new Error(
          `Your current plan allows ${max} active staff members.`
        );
        error.status = 402;
        error.code = "STAFF_LIMIT_REACHED";
        throw error;
      }
    }
    return work();
  });
}
module.exports = { create, changeStaff };
