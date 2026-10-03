/**
 * Dashboard Controller
 * Uses consolidated SQL plus a short Redis cache to reduce database load.
 */

const AuthorizationService = require('../services/authorization.service');
const DashboardCacheService = require('../services/dashboardCache.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');
const db = require('../config/database');

const VALID_PERIODS = new Set(['today', 'week', 'month', 'year']);
const VALID_ORDER_TYPES = new Set(['stitching', 'alteration']);

const getFromDate = (period, now = new Date()) => {
  const today = now.toISOString().split('T')[0];

  if (period === 'today') return today;
  if (period === 'week') {
    const date = new Date(now);
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  }
  if (period === 'year') {
    return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  }

  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

const loadDashboardStats = async ({ shopId, period, orderType, today, fromDate }) => {
  const params = [shopId, today, fromDate, orderType];

  const [summary, deliveryRows, weeklyRevenue, topCustomers] = await Promise.all([
    db.queryRow(
      `WITH filtered_orders AS (
         SELECT status, total_amount, balance_due, delivery_date
         FROM orders
         WHERE shop_id = $1
           AND ($4::text IS NULL OR order_type = $4)
       ),
       order_summary AS (
         SELECT
           COUNT(*)::int AS total_orders,
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
           COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_count,
           COUNT(*) FILTER (WHERE status = 'ready')::int AS ready_count,
           COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_count,
           COUNT(*) FILTER (WHERE delivery_date < $2::date AND status <> 'delivered')::int AS overdue_count,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered'), 0) AS total_revenue,
           COALESCE(SUM(balance_due) FILTER (WHERE status <> 'delivered'), 0) AS pending_revenue
         FROM filtered_orders
       ),
       type_stats AS (
         SELECT
           COUNT(*) FILTER (WHERE order_type = 'stitching' AND created_at >= $3::date)::int AS stitching_count,
           COALESCE(SUM(total_amount) FILTER (WHERE order_type = 'stitching' AND created_at >= $3::date), 0) AS stitching_revenue,
           COUNT(*) FILTER (WHERE order_type = 'alteration' AND created_at >= $3::date)::int AS alteration_count,
           COALESCE(SUM(total_amount) FILTER (WHERE order_type = 'alteration' AND created_at >= $3::date), 0) AS alteration_revenue
         FROM orders
         WHERE shop_id = $1
       ),
       customer_stats AS (
         SELECT
           COUNT(*)::int AS total_customers,
           COUNT(*) FILTER (WHERE created_at >= $3::date)::int AS new_customers
         FROM customers
         WHERE shop_id = $1
       )
       SELECT *
       FROM order_summary
       CROSS JOIN type_stats
       CROSS JOIN customer_stats`,
      params
    ),
    db.queryAll(
      `WITH filtered_orders AS (
         SELECT id, customer_id, total_amount, status, delivery_date, created_at
         FROM orders
         WHERE shop_id = $1
           AND ($4::text IS NULL OR order_type = $4)
       )
       (SELECT 'today' AS bucket, id, customer_id, total_amount, status, delivery_date
        FROM filtered_orders
        WHERE delivery_date = $2::date AND status <> 'delivered'
        ORDER BY created_at DESC
        LIMIT 10)
       UNION ALL
       (SELECT 'overdue' AS bucket, id, customer_id, total_amount, status, delivery_date
        FROM filtered_orders
        WHERE delivery_date < $2::date AND status <> 'delivered'
        ORDER BY delivery_date ASC, created_at DESC
        LIMIT 10)`,
      params
    ),
    db.queryAll(
      `SELECT
         DATE(created_at) AS date,
         COALESCE(SUM(total_amount), 0) AS revenue,
         COUNT(*)::int AS orders
       FROM orders
       WHERE shop_id = $1
         AND created_at >= NOW() - INTERVAL '7 days'
         AND ($4::text IS NULL OR order_type = $4)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      params
    ),
    db.queryAll(
      `SELECT
         c.id,
         c.name,
         c.phone,
         COUNT(o.id)::int AS order_count,
         COALESCE(SUM(o.total_amount), 0) AS total_revenue
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
       WHERE c.shop_id = $1
       GROUP BY c.id, c.name, c.phone
       ORDER BY total_revenue DESC
       LIMIT 5`,
      [shopId]
    ),
  ]);

  const stripBucket = ({ bucket, ...row }) => row;
  const todayDeliveries = deliveryRows.filter((row) => row.bucket === 'today').map(stripBucket);
  const overdueOrders = deliveryRows.filter((row) => row.bucket === 'overdue').map(stripBucket);

  return {
    period,
    order_type: orderType,
    totalOrders: Number(summary?.total_orders || 0),
    orderCounts: {
      pending: Number(summary?.pending_count || 0),
      in_progress: Number(summary?.in_progress_count || 0),
      ready: Number(summary?.ready_count || 0),
      delivered: Number(summary?.delivered_count || 0),
    },
    totalRevenue: Number(summary?.total_revenue || 0),
    pendingRevenue: Number(summary?.pending_revenue || 0),
    totalPayments: Number(summary?.total_revenue || 0),
    totalCustomers: Number(summary?.total_customers || 0),
    newCustomers: Number(summary?.new_customers || 0),
    pastDue: Number(summary?.overdue_count || 0),
    stitchingStats: {
      count: Number(summary?.stitching_count || 0),
      revenue: Number(summary?.stitching_revenue || 0),
    },
    alterationStats: {
      count: Number(summary?.alteration_count || 0),
      revenue: Number(summary?.alteration_revenue || 0),
    },
    todayDeliveries,
    trialsToday: [],
    overdueOrders,
    weeklyRevenue: weeklyRevenue.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue || 0),
      orders: Number(row.orders || 0),
    })),
    topCustomers: topCustomers.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      orderCount: Number(row.order_count || 0),
      totalRevenue: Number(row.total_revenue || 0),
    })),
  };
};

exports.getDashboardStats = async (req, res) => {
  try {
    const requestedPeriod = String(req.query.period || 'month').toLowerCase();
    const period = VALID_PERIODS.has(requestedPeriod) ? requestedPeriod : 'month';
    const requestedType = String(req.query.order_type || '').toLowerCase();
    const orderType = VALID_ORDER_TYPES.has(requestedType) ? requestedType : null;

    const shop = await AuthorizationService.getUserShop(req.user.id);
    const today = new Date().toISOString().split('T')[0];
    const fromDate = getFromDate(period);

    const stats = await DashboardCacheService.getDashboardStatsWithCache(
      shop.id,
      period,
      orderType,
      () => loadDashboardStats({
        shopId: shop.id,
        period,
        orderType,
        today,
        fromDate,
      })
    );

    responder.success(res, 200, 'Dashboard stats retrieved', stats);
  } catch (error) {
    logger.error('Get dashboard stats error:', error.message);
    responder.error(res, 500, 'Failed to get dashboard stats', error.message);
  }
};

exports.loadDashboardStats = loadDashboardStats;
exports.getFromDate = getFromDate;
