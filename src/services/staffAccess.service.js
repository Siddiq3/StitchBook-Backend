const { hasPermission } = require("./permissions.service");

const can = (actor, permission) =>
  hasPermission(actor?.permissions || [], permission);
// Shop-wide access is explicit. Other staff only see work assigned to their staff ID.
const isScoped = (actor) =>
  actor?.actorType === "staff" && !can(actor, "*") && actor.role !== "manager";
const assignmentKeys = [
  "cutter_staff_id",
  "cutterStaffId",
  "assigned_cutter_id",
  "stitcher_staff_id",
  "stitcherStaffId",
  "assigned_stitcher_id",
  "assigned_to",
  "staff_id",
];
const itemAssigned = (item, staffId) =>
  staffId != null &&
  assignmentKeys.some(
    (key) => item?.[key] != null && String(item[key]) === String(staffId)
  );
const itemsOf = (order) => {
  const items =
    typeof order?.items === "string" ? JSON.parse(order.items) : order?.items;
  return Array.isArray(items) ? items : [];
};
const orderAssigned = (order, actor) =>
  !isScoped(actor) ||
  (actor.staffId != null &&
    (String(order.assigned_to || "") === String(actor.staffId) ||
      itemsOf(order).some((item) => itemAssigned(item, actor.staffId))));
const assignmentSql = (alias, parameter) => `(
  to_jsonb(${alias})->>'assigned_to' = ${parameter}::text OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${alias}.items::jsonb) = 'array' THEN ${alias}.items::jsonb ELSE '[]'::jsonb END) item
    WHERE ${assignmentKeys
      .map((key) => `item->>'${key}' = ${parameter}::text`)
      .join(" OR ")}
  )
)`;
const pick = (value, keys) =>
  Object.fromEntries(
    keys
      .filter((key) => value?.[key] !== undefined)
      .map((key) => [key, value[key]])
  );
const publicItemFields = [
  "id",
  "type",
  "typeLabel",
  "name",
  "item_name",
  "quantity",
  "qty",
  "fabric",
  "fabricType",
  "color",
  "size",
  "itemType",
  "type_category",
  "image",
  "imageUrl",
  "image_url",
  "photo_url",
  "images",
  "referenceImages",
  "stitchingOptions",
  "alterationOptions",
  "options",
  "cutter_staff_id",
  "stitcher_staff_id",
  "cutter_name",
  "stitcher_name",
  ...assignmentKeys,
];
const serializeOrder = (order, actor) => {
  if (!order) return order;
  const items = itemsOf(order).filter(
    (item) =>
      !isScoped(actor) ||
      String(order.assigned_to || "") === String(actor.staffId) ||
      itemAssigned(item, actor.staffId)
  );
  const financial = can(actor, "payments:read");
  const result = financial
    ? { ...order }
    : pick(order, [
        "id",
        "order_number",
        "customer_id",
        "customerName",
        "customer_name",
        "shop_id",
        "status",
        "delivery_date",
        "priority",
        "order_type",
        "created_at",
        "updated_at",
      ]);
  result.items = items.map((item) => {
    const visible = financial ? { ...item } : pick(item, publicItemFields);
    if (can(actor, "measurements:read")) {
      for (const key of [
        "measurementSnapshot",
        "measurement_snapshot",
        "measurements",
        "measurementData",
        "measurementLabel",
        "measurement_id",
      ])
        if (item[key] !== undefined) visible[key] = item[key];
    } else {
      for (const key of [
        "measurementSnapshot",
        "measurement_snapshot",
        "measurements",
        "measurementData",
        "measurementLabel",
        "measurement_id",
      ])
        delete visible[key];
    }
    return visible;
  });
  // An order-wide snapshot can contain other staff's items. Scoped staff receive
  // only their item snapshots and use the authorized measurement endpoint.
  if (can(actor, "measurements:read") && !isScoped(actor)) {
    for (const key of ["measurement", "measurement_id", "measurement_snapshot"])
      if (order[key] !== undefined) result[key] = order[key];
  } else {
    delete result.measurement;
    delete result.measurement_id;
    delete result.measurement_snapshot;
  }
  return result;
};
module.exports = {
  can,
  isScoped,
  assignmentSql,
  orderAssigned,
  serializeOrder,
  itemAssigned,
  assignmentKeys,
};
