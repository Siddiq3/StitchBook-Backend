/**
 * Dashboard Controller
 * Handles dashboard statistics and analytics
 */

const OrderModel = require('../models/order.model');
const PaymentModel = require('../models/payment.model');
const CustomerModel = require('../models/customer.model');
const AuthorizationService = require('../services/authorization.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * GET /dashboard/stats
 * Get comprehensive dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month', order_type } = req.query;

    // Validate order_type
    const validOrderTypes = ['stitching', 'alteration'];
    const filterOrderType = validOrderTypes.includes(order_type) ? order_type : null;

    // Get user's shop
    const shop = await AuthorizationService.getUserShop(userId);
    const shopId = shop.id;

    // Period boundaries are Indian calendar days. created_at is stored as UTC
    // (timestamp without time zone), so convert it before comparing.
    // ponytail: shop timezone is fixed to Asia/Kolkata; add a shops.timezone column if shops outside India sign up.
    const LOCAL_DAY = `((NOW() AT TIME ZONE 'Asia/Kolkata')::date)`;
    const PERIOD_START = {
      today: LOCAL_DAY,
      week: `(${LOCAL_DAY} - 6)`,
      month: `date_trunc('month', ${LOCAL_DAY})::date`,
      year: `date_trunc('year', ${LOCAL_DAY})::date`,
    }[period] || `date_trunc('month', ${LOCAL_DAY})::date`;
    const CREATED_DAY = `((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date`;
    // order_type is whitelisted above, so it is safe to inline
    const typeFilter = filterOrderType ? ` AND o.order_type = '${filterOrderType}'` : '';
    const trendBucket = period === 'year' ? 'month' : 'day';

    const [booked, received, outstanding, workload, trend, customers] = await Promise.all([
      // Orders booked in the period and their value
      db.queryRow(
        `SELECT COUNT(*) AS count, COALESCE(SUM(o.total_amount), 0) AS value
           FROM orders o WHERE o.shop_id = $1 AND ${CREATED_DAY} >= ${PERIOD_START}${typeFilter}`,
        [shopId]
      ),
      // Money actually received in the period (advances + later payments)
      db.queryRow(
        `SELECT COALESCE(SUM(p.amount), 0) AS amount
           FROM payments p JOIN orders o ON o.id = p.order_id
          WHERE p.shop_id = $1 AND p.payment_date >= ${PERIOD_START}${typeFilter}`,
        [shopId]
      ),
      // Still to collect on every open order, regardless of period
      db.queryRow(
        `SELECT COALESCE(SUM(o.balance_due), 0) AS amount
           FROM orders o WHERE o.shop_id = $1 AND o.status <> 'delivered'${typeFilter}`,
        [shopId]
      ),
      // Current workload by stage
      db.queryAll(
        `SELECT o.status, COUNT(*) AS count FROM orders o WHERE o.shop_id = $1${typeFilter} GROUP BY o.status`,
        [shopId]
      ),
      // Payments received per day (per month for the year view)
      db.queryAll(
        `SELECT date_trunc('${trendBucket}', p.payment_date)::date AS date, COALESCE(SUM(p.amount), 0) AS revenue
           FROM payments p JOIN orders o ON o.id = p.order_id
          WHERE p.shop_id = $1 AND p.payment_date >= ${PERIOD_START}${typeFilter}
          GROUP BY 1 ORDER BY 1`,
        [shopId]
      ),
      db.queryRow(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE ((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date >= ${PERIOD_START}) AS new
           FROM customers WHERE shop_id = $1`,
        [shopId]
      ),
    ]);

    const countOf = (...statuses) => workload
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + parseInt(row.count, 10), 0);

    const stats = {
      period,
      order_type: filterOrderType,
      ordersBooked: parseInt(booked?.count || 0, 10),
      bookedValue: parseFloat(booked?.value || 0),
      paymentsReceived: parseFloat(received?.amount || 0),
      outstandingBalance: parseFloat(outstanding?.amount || 0),
      totalCustomers: parseInt(customers?.total || 0, 10),
      newCustomers: parseInt(customers?.new || 0, 10),
      orderCounts: {
        pending: countOf('pending', 'new', 'started'),
        in_progress: countOf('in_progress', 'cutting', 'stitching'),
        ready: countOf('ready'),
        delivered: countOf('delivered'),
      },
      // Kept for older app builds: revenue now means money received in the period
      totalRevenue: parseFloat(received?.amount || 0),
      pendingRevenue: parseFloat(outstanding?.amount || 0),
      weeklyRevenue: trend.map((row) => ({ date: row.date, revenue: parseFloat(row.revenue) })),
    };

    logger.info(`Dashboard stats retrieved for shop: ${shopId}`);
    responder.success(res, 200, 'Dashboard stats retrieved', stats);
  } catch (error) {
    logger.error('Get dashboard stats error:', error.message);
    responder.error(res, 500, 'Failed to get dashboard stats', error.message);
  }
};
