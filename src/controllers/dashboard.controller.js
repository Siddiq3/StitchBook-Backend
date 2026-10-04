/**
 * Dashboard Controller
 * Preserves current dashboard semantics while consolidating queries and caching results.
 */

const AuthorizationService = require('../services/authorization.service');
const DashboardCacheService = require('../services/dashboardCache.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');
const db = require('../config/database');

const VALID_PERIODS = new Set(['today', 'week', 'month', 'year']);
const VALID_ORDER_TYPES = new Set(['stitching', 'alteration']);

const localDay = `((NOW() AT TIME ZONE 'Asia/Kolkata')::date)`;

const periodStartSql = (period) => ({
  today: localDay,
  week: `(${localDay} - 6)`,
  month: `date_trunc('month', ${localDay})::date`,
  year: `date_trunc('year', ${localDay})::date`,
}[period] || `date_trunc('month', ${localDay})::date`);

const loadDashboardStats = async ({ shopId, period, orderType }) => {
  const periodStart = periodStartSql(period);
  const createdDay = `((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date`;
  const trendBucket = period === 'year' ? 'month' : 'day';
  const params = [shopId, orderType];

  const [summary, trend] = await Promise.all([
    db.queryRow(
      `WITH period_bounds AS (
         SELECT ${periodStart} AS period_start
       ),
       booked AS (
         SELECT COUNT(*)::int AS count,
                COALESCE(SUM(o.total_amount), 0) AS value
           FROM orders o
           CROSS JOIN period_bounds b
          WHERE o.shop_id = $1
            AND ${createdDay} >= b.period_start
            AND ($2::text IS NULL OR o.order_type = $2)
       ),
       received AS (
         SELECT COALESCE(SUM(p.amount), 0) AS amount
           FROM payments p
           JOIN orders o ON o.id = p.order_id
           CROSS JOIN period_bounds b
          WHERE p.shop_id = $1
            AND p.payment_date >= b.period_start
            AND ($2::text IS NULL OR o.order_type = $2)
       ),
       outstanding AS (
         SELECT COALESCE(SUM(o.balance_due), 0) AS amount
           FROM orders o
          WHERE o.shop_id = $1
            AND o.status <> 'delivered'
            AND ($2::text IS NULL OR o.order_type = $2)
       ),
       workload AS (
         SELECT
           COUNT(*) FILTER (WHERE o.status = 'pending')::int AS pending_count,
           COUNT(*) FILTER (WHERE o.status IN ('in_progress', 'cutting', 'stitching'))::int AS in_progress_count,
           COUNT(*) FILTER (WHERE o.status = 'ready')::int AS ready_count,
           COUNT(*) FILTER (WHERE o.status = 'delivered')::int AS delivered_count
           FROM orders o
          WHERE o.shop_id = $1
            AND ($2::text IS NULL OR o.order_type = $2)
       ),
       customer_stats AS (
         SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (
                  WHERE ((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date >= b.period_start
                )::int AS new
           FROM customers
           CROSS JOIN period_bounds b
          WHERE shop_id = $1
       )
       SELECT
         booked.count AS orders_booked,
         booked.value AS booked_value,
         received.amount AS payments_received,
         outstanding.amount AS outstanding_balance,
         workload.pending_count,
         workload.in_progress_count,
         workload.ready_count,
         workload.delivered_count,
         customer_stats.total AS total_customers,
         customer_stats.new AS new_customers
       FROM booked
       CROSS JOIN received
       CROSS JOIN outstanding
       CROSS JOIN workload
       CROSS JOIN customer_stats`,
      params
    ),
    db.queryAll(
      `SELECT date_trunc('${trendBucket}', p.payment_date)::date AS date,
              COALESCE(SUM(p.amount), 0) AS revenue
         FROM payments p
         JOIN orders o ON o.id = p.order_id
        WHERE p.shop_id = $1
          AND p.payment_date >= ${periodStart}
          AND ($2::text IS NULL OR o.order_type = $2)
        GROUP BY 1
        ORDER BY 1`,
      params
    ),
  ]);

  const paymentsReceived = Number(summary?.payments_received || 0);
  const outstandingBalance = Number(summary?.outstanding_balance || 0);

  return {
    period,
    order_type: orderType,
    ordersBooked: Number(summary?.orders_booked || 0),
    bookedValue: Number(summary?.booked_value || 0),
    paymentsReceived,
    outstandingBalance,
    totalCustomers: Number(summary?.total_customers || 0),
    newCustomers: Number(summary?.new_customers || 0),
    orderCounts: {
      pending: Number(summary?.pending_count || 0),
      in_progress: Number(summary?.in_progress_count || 0),
      ready: Number(summary?.ready_count || 0),
      delivered: Number(summary?.delivered_count || 0),
    },
    // Backward-compatible aliases used by older app builds.
    totalRevenue: paymentsReceived,
    pendingRevenue: outstandingBalance,
    weeklyRevenue: trend.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue || 0),
    })),
  };
};

/**
 * GET /dashboard/stats
 * Get comprehensive dashboard statistics.
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const requestedPeriod = String(req.query.period || 'month').toLowerCase();
    const period = VALID_PERIODS.has(requestedPeriod) ? requestedPeriod : 'month';
    const requestedType = String(req.query.order_type || '').toLowerCase();
    const orderType = VALID_ORDER_TYPES.has(requestedType) ? requestedType : null;

    const shop = await AuthorizationService.getUserShop(req.user.id);

    const stats = await DashboardCacheService.getDashboardStatsWithCache(
      shop.id,
      period,
      orderType,
      () => loadDashboardStats({
        shopId: shop.id,
        period,
        orderType,
      })
    );

    responder.success(res, 200, 'Dashboard stats retrieved', stats);
  } catch (error) {
    logger.error('Get dashboard stats error:', error.message);
    responder.error(res, 500, 'Failed to get dashboard stats', error.message);
  }
};

exports.loadDashboardStats = loadDashboardStats;
exports.periodStartSql = periodStartSql;
