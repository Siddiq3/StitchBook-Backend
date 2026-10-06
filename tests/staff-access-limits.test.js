const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const Access = require("../src/services/staffAccess.service");
const { getRolePermissions } = require("../src/services/permissions.service");
const logger = { info() {}, debug() {}, error() {}, warn() {} };
function load(file, mocks) {
  const module = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    {
      module,
      exports: module.exports,
      process,
      require(name) {
        assert.ok(name in mocks, `Unexpected import ${name}`);
        return mocks[name];
      },
    }
  );
  return module.exports;
}
const actor = (role) => ({
  id: 1,
  actorType: role === "owner" ? "owner" : "staff",
  role,
  staffId: 7,
  permissions: getRolePermissions(role),
});
const order = {
  id: 20,
  shop_id: 3,
  customer_id: 4,
  total_amount: 999,
  advance_paid: 100,
  balance_due: 899,
  notes: "private billing",
  measurement: { private: true },
  measurement_snapshot: { private: true },
  items: [
    {
      type: "shirt",
      quantity: 1,
      cutter_staff_id: 7,
      stitcher_staff_id: 8,
      price: 500,
      measurementData: { chest: 40 },
      measurementSnapshot: { measurementsData: { chest: 40 } },
    },
    {
      type: "pant",
      quantity: 1,
      cutter_staff_id: 9,
      stitcher_staff_id: 10,
      price: 499,
      measurementSnapshot: { measurementsData: { waist: 30 } },
    },
  ],
};
test("owners/managers retain shop access; every other role needs a matching assignment", () => {
  for (const role of ["owner", "manager"])
    assert.equal(
      Access.orderAssigned({ ...order, items: [] }, actor(role)),
      true
    );
  for (const role of ["cutter", "stitcher", "delivery", "helper"]) {
    assert.equal(Access.orderAssigned(order, actor(role)), true);
    assert.equal(
      Access.orderAssigned(order, { ...actor(role), staffId: 11 }),
      false
    );
    assert.equal(
      Access.orderAssigned(order, { ...actor(role), staffId: null }),
      false
    );
  }
  assert.equal(
    Access.orderAssigned(
      { ...order, items: [], assigned_to: 7 },
      actor("helper")
    ),
    true
  );
});
test("assigned staff receive only their items and no money or unauthorized measurements", () => {
  const cutter = Access.serializeOrder(order, actor("cutter"));
  assert.equal(cutter.items.length, 1);
  assert.equal(cutter.items[0].measurementData.chest, 40);
  for (const role of ["cutter", "stitcher", "delivery", "helper"]) {
    const visible = Access.serializeOrder(order, actor(role));
    for (const field of [
      "total_amount",
      "balance_due",
      "advance_paid",
      "notes",
      "measurement",
      "measurement_snapshot",
    ])
      assert.equal(field in visible, false, field);
    assert.equal("price" in visible.items[0], false);
    if (role !== "cutter")
      for (const field of ["measurementData", "measurementSnapshot"])
        assert.equal(field in visible.items[0], false, field);
  }
  assert.equal(order.items.length, 2);
  assert.equal(order.items[0].price, 500);
  assert.deepEqual(Access.serializeOrder(order, actor("owner")), order);
  const custom = { ...actor("manager"), permissions: ["payments:read"] };
  assert.equal(
    "measurementData" in Access.serializeOrder(order, custom).items[0],
    false
  );
});
test("direct order/customer/measurement authorization rejects unassigned and foreign resources", async () => {
  let assigned = false,
    shopId = 3;
  const auth = load("services/authorization.service.js", {
    "../models/customer.model": {
      getCustomerById: async () => ({ id: 4, shop_id: shopId }),
    },
    "../models/order.model": {
      getOrderById: async () => ({ ...order, shop_id: shopId }),
    },
    "../models/measurement.model": {
      getMeasurementById: async () => ({ id: 6, customer_id: 4 }),
    },
    "../config/database": {
      queryRow: async (sql) =>
        sql.includes("SELECT s.*") ? { id: 3 } : assigned ? { id: 20 } : null,
    },
    "../utils/logger": logger,
    "./staffAccess.service": Access,
  });
  await assert.rejects(
    auth.verifyOrderOwnership(1, 20, { ...actor("helper"), staffId: 11 }),
    /Unauthorized/
  );
  await assert.rejects(
    auth.verifyCustomerOwnership(1, 4, actor("cutter")),
    /Unauthorized/
  );
  await assert.rejects(
    auth.verifyMeasurementOwnership(1, 6, actor("cutter")),
    /Unauthorized/
  );
  assigned = true;
  assert.equal(
    (await auth.verifyOrderOwnership(1, 20, actor("cutter"))).id,
    20
  );
  assert.equal(
    (await auth.verifyMeasurementOwnership(1, 6, actor("cutter"))).id,
    6
  );
  shopId = 99;
  await assert.rejects(
    auth.verifyOrderOwnership(1, 20, actor("owner")),
    /Unauthorized/
  );
  await assert.rejects(
    auth.verifyMeasurementOwnership(1, 6, actor("owner")),
    /Unauthorized/
  );
});
test("list count, search and page queries share assignment/shop scope and stable ordering", async () => {
  const calls = [];
  const lists = load("services/pagedLists.service.js", {
    "../config/database": {
      queryRow: async (sql, values) => {
        calls.push({ sql, values });
        return { total: 101 };
      },
      queryAll: async (sql, values) => {
        calls.push({ sql, values });
        return [order];
      },
    },
    "./staffAccess.service": Access,
  });
  const result = await lists.orders(actor("cutter"), 3, {
    page: 2,
    limit: 50,
    status: "cutting",
    search: "x' OR 1=1 --",
  });
  assert.equal(result.pagination.total, 101);
  assert.equal(result.pagination.hasMore, true);
  assert.equal(result.orders[0].items.length, 1);
  for (const call of calls) {
    assert.match(call.sql, /o.shop_id=\$1/);
    assert.match(call.sql, /cutter_staff_id/);
    assert.match(call.sql, /IN \('cutting','in_progress'\)/);
    assert.equal(call.sql.includes("x' OR"), false);
    assert.equal(call.values[1], 7);
    assert.equal(call.sql.includes("SUM(o.total_amount)"), false);
  }
  assert.match(calls[1].sql, /ORDER BY o.created_at DESC,o.id DESC/);
  assert.deepEqual(Array.from(calls[1].values).slice(-2), [50, 50]);
  calls.length = 0;
  await lists.customers(actor("cutter"), 3, {
    page: 3,
    limit: 50,
    search: "Jane",
  });
  assert.match(calls[0].sql, /EXISTS .*FROM orders/s);
  assert.deepEqual(Array.from(calls[1].values), [3, 7, "%Jane%", 50, 100]);
  calls.length = 0;
  await lists.orders({ ...actor("helper"), staffId: null }, 3, {
    page: 1,
    limit: 50,
  });
  assert.equal(calls[0].values[1], null);
});
function quotaHarness({
  customers = 499,
  orders = 199,
  staff = 1,
  maxStaff = 2,
  unlimited = false,
  active = true,
} = {}) {
  const counts = { customers, orders, staff };
  let existingActive = false;
  const events = [];
  let tail = Promise.resolve();
  const db = {
    transaction(work) {
      const next = tail.then(work);
      tail = next.catch(() => {});
      return next;
    },
    query: async (sql) => {
      assert.match(sql, /FOR UPDATE/);
      events.push("lock");
    },
    queryRow: async (sql) =>
      sql.includes("SELECT is_active")
        ? { is_active: existingActive }
        : { count: counts[sql.match(/FROM (customers|orders|staff)/)[1]] },
  };
  const limits = load("services/planLimits.service.js", {
    "../config/database": db,
    "./subscription.service": {
      getSubscriptionForActor: async () => ({
        canUseApp: active,
        planType: "trial",
        features: {
          maxCustomers: unlimited ? -1 : 500,
          maxOrders: unlimited ? -1 : 200,
          maxStaff,
        },
      }),
    },
  });
  return {
    counts,
    events,
    limits,
    setExisting: () => {
      existingActive = true;
    },
  };
}
test("trial boundaries allow the last customer/order and reject the next write", async () => {
  for (const resource of ["customers", "orders"]) {
    const q = quotaHarness();
    const work = async () => ++q.counts[resource];
    await q.limits.create(actor("owner"), 3, resource, work);
    await assert.rejects(
      q.limits.create(actor("owner"), 3, resource, work),
      (e) => e.code === "PLAN_LIMIT_REACHED" && e.status === 402
    );
    assert.equal(q.counts[resource], resource === "customers" ? 500 : 200);
    assert.equal(q.events.length, 2);
  }
});
test("concurrent quota requests recheck after locking; paid plans remain unlimited; expiry rejects", async () => {
  const q = quotaHarness();
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      q.limits.create(
        actor("owner"),
        3,
        "orders",
        async () => ++q.counts.orders
      )
    )
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(q.counts.orders, 200);
  const paid = quotaHarness({ unlimited: true, orders: 9999 });
  await paid.limits.create(
    actor("owner"),
    3,
    "orders",
    async () => ++paid.counts.orders
  );
  assert.equal(paid.counts.orders, 10000);
  const expired = quotaHarness({ active: false });
  await assert.rejects(
    expired.limits.create(actor("owner"), 3, "orders", () =>
      assert.fail("must not write")
    ),
    (e) => e.code === "SUBSCRIPTION_REQUIRED"
  );
});
test("staff activation and creation share the limit; edits/deactivation remain possible at capacity", async () => {
  const q = quotaHarness({ staff: 2 });
  for (const id of [null, 9])
    await assert.rejects(
      q.limits.changeStaff(actor("owner"), 3, id, true, () =>
        assert.fail("must not write")
      ),
      (e) => e.code === "STAFF_LIMIT_REACHED"
    );
  await q.limits.changeStaff(actor("owner"), 3, 9, false, async () => true);
  q.setExisting();
  await q.limits.changeStaff(actor("owner"), 3, 9, true, async () => true);
});
test("database transactions use one client, isolate concurrent work, and rollback/release on failure", async () => {
  let next = 0;
  const events = [];
  class Pool {
    on() {}
    async query() {
      assert.fail("transaction escaped into pool");
    }
    async connect() {
      const id = ++next;
      return {
        query: async (sql) => {
          events.push([id, sql]);
          return { rows: [{ id }] };
        },
        release() {
          events.push([id, "release"]);
        },
      };
    }
  }
  const db = load("config/database.js", {
    pg: { Pool, types: { setTypeParser() {} } },
    "node:async_hooks": require("node:async_hooks"),
    "../utils/logger": logger,
    "./env": {},
    "./databaseTls": { databaseTlsConfig: () => ({}) },
  });
  await Promise.all([
    db.transaction(async () => {
      const row = await db.queryRow("read-a");
      await db.transaction(() => db.query("nested"));
      return row;
    }),
    db.transaction(() => db.query("read-b")),
  ]);
  assert.deepEqual(
    events.filter((e) => e[0] === 1).map((e) => e[1]),
    ["BEGIN", "read-a", "nested", "COMMIT", "release"]
  );
  assert.deepEqual(
    events.filter((e) => e[0] === 2).map((e) => e[1]),
    ["BEGIN", "read-b", "COMMIT", "release"]
  );
  await assert.rejects(
    db.transaction(async () => {
      await db.query("write");
      throw new Error("fail");
    }),
    /fail/
  );
  assert.deepEqual(
    events.filter((e) => e[0] === 3).map((e) => e[1]),
    ["BEGIN", "write", "ROLLBACK", "release"]
  );
});
test("order controllers enforce assignment on direct reads, edits, deletes and status changes", async () => {
  let actorPassed,
    writes = 0;
  const controller = load("controllers/order.controller.js", {
    "../services/order.service": {
      updateOrder: async () => {
        writes++;
      },
      deleteOrder: async () => {
        writes++;
      },
    },
    "../services/authorization.service": {
      verifyOrderOwnership: async (_user, _id, user) => {
        actorPassed = user;
        throw new Error("Unauthorized: Order is not assigned to you");
      },
    },
    "../models/activity.model": {},
    "../utils/responder": require("../src/utils/responder"),
    "../utils/logger": logger,
    "../utils/pagination": require("../src/utils/pagination"),
    "../services/pagedLists.service": {},
    "../services/planLimits.service": {},
    "../services/staffAccess.service": Access,
  });
  for (const action of [
    "getOrder",
    "updateOrder",
    "deleteOrder",
    "updateOrderStatus",
  ]) {
    const req = {
      user: actor("cutter"),
      params: { id: 20 },
      body: { status: "cutting" },
    };
    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      json(body) {
        this.body = body;
      },
    };
    await controller[action](req, res);
    assert.equal(res.code, 403);
    assert.equal(actorPassed, req.user);
  }
  assert.equal(writes, 0);
});
test("report, notification and activity routes reject roles without financial read permission", () => {
  for (const file of ["dashboard", "notification", "activity"]) {
    const guards = [];
    const router = {
      use: (fn) => guards.push(fn),
      get() {},
      post() {},
      put() {},
      delete() {},
    };
    const controller = new Proxy({}, { get: () => () => {} });
    load(`routes/${file}.routes.js`, {
      express: { Router: () => router },
      [`../controllers/${file}.controller`]: controller,
      "../middleware/auth": () => {},
      "../middleware/subscriptionGate": () => {},
      "../middleware/permissions": require("../src/middleware/permissions"),
    });
    let denied = false;
    const res = {
      status(code) {
        denied = code === 403;
        return this;
      },
      json() {},
    };
    guards.forEach((guard) => guard({ user: actor("cutter") }, res, () => {}));
    assert.equal(denied, true, file);
  }
});
