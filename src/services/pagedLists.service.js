const db = require("../config/database");
const Access = require("./staffAccess.service");
const pageResult = (items, total, page, limit, key) => ({
  [key]: items,
  pagination: {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    hasMore: page * limit < total,
  },
});
async function orders(
  actor,
  shopId,
  { page, limit, status, customerId, search = "" }
) {
  const values = [shopId];
  const where = ["o.shop_id=$1"];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };
  if (Access.isScoped(actor))
    where.push(Access.assignmentSql("o", add(actor.staffId || null)));
  if (status === "cutting" || status === "in_progress")
    where.push("o.status IN ('cutting','in_progress')");
  else if (status) where.push(`o.status=${add(status)}`);
  if (customerId) where.push(`o.customer_id=${add(customerId)}`);
  if (String(search).trim()) {
    const p = add("%" + String(search).trim() + "%");
    const staffFilter = Access.isScoped(actor)
      ? ` AND (${Access.assignmentKeys
          .map((key) => `item->>'${key}' = $2::text`)
          .join(" OR ")} OR to_jsonb(o)->>'assigned_to' = $2::text)`
      : "";
    where.push(`(o.order_number ILIKE ${p} OR c.name ILIKE ${p} OR c.phone ILIKE ${p} OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.items::jsonb)='array' THEN o.items::jsonb ELSE '[]'::jsonb END) item
      WHERE (item->>'type' ILIKE ${p} OR item->>'typeLabel' ILIKE ${p} OR item->>'name' ILIKE ${p})${staffFilter}))`);
  }
  const from = `FROM orders o LEFT JOIN customers c ON c.id=o.customer_id AND c.shop_id=o.shop_id WHERE ${where.join(
    " AND "
  )}`;
  const financialAggregate = Access.can(actor, "payments:read")
    ? ", COALESCE(SUM(o.total_amount),0) AS revenue"
    : "";
  const count = await db.queryRow(
    `SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE o.status='pending')::int AS pending,
    COUNT(*) FILTER (WHERE o.status IN ('cutting','in_progress'))::int AS cutting,
    COUNT(*) FILTER (WHERE o.status='stitching')::int AS stitching,
    COUNT(*) FILTER (WHERE o.status='ready')::int AS ready,
    COUNT(*) FILTER (WHERE o.status='delivered')::int AS delivered,
    COUNT(*) FILTER (WHERE o.status NOT IN ('ready','delivered','cancelled'))::int AS queued,
    COUNT(*) FILTER (WHERE o.status <> 'delivered')::int AS active
    ${financialAggregate} ${from}`,
    values
  );
  const rows = await db.queryAll(
    `SELECT o.*, c.name AS "customerName" ${from} ORDER BY o.created_at DESC,o.id DESC LIMIT $${
      values.length + 1
    } OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit]
  );
  return {
    ...pageResult(
      rows.map((row) => Access.serializeOrder(row, actor)),
      Number(count.total),
      page,
      limit,
      "orders"
    ),
    summary: count,
  };
}
async function customers(actor, shopId, { page, limit, search = "" }) {
  const values = [shopId];
  const where = ["c.shop_id=$1"];
  if (Access.isScoped(actor)) {
    values.push(actor.staffId || null);
    where.push(
      `EXISTS (SELECT 1 FROM orders o WHERE o.shop_id=c.shop_id AND o.customer_id=c.id AND ${Access.assignmentSql(
        "o",
        "$2"
      )})`
    );
  }
  if (String(search).trim()) {
    values.push("%" + String(search).trim() + "%");
    const p = `$${values.length}`;
    where.push(`(c.name ILIKE ${p} OR c.phone ILIKE ${p})`);
  }
  const from = `FROM customers c WHERE ${where.join(" AND ")}`;
  const count = await db.queryRow(
    `SELECT COUNT(*)::int AS total ${from}`,
    values
  );
  const assignedOrders = Access.isScoped(actor)
    ? ` AND ${Access.assignmentSql("co", "$2")}`
    : "";
  const rows = await db.queryAll(
    `SELECT (SELECT COUNT(*)::int FROM orders co WHERE co.shop_id=c.shop_id AND co.customer_id=c.id${assignedOrders}) AS "orderCount", c.id,c.shop_id,c.name,c.phone,c.gender,c.email,c.date_of_birth,c.photo_url,c.created_at,c.updated_at ${from} ORDER BY c.created_at DESC,c.id DESC LIMIT $${
      values.length + 1
    } OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit]
  );
  return pageResult(rows, Number(count.total), page, limit, "customers");
}
module.exports = { orders, customers };
