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

    // Calculate date range
    const today = new Date().toISOString().split('T')[0];
    let fromDate;
    
    if (period === 'today') {
      fromDate = today;
    } else if (period === 'week') {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      fromDate = date.toISOString().split('T')[0];
    } else if (period === 'month') {
      const date = new Date();
      fromDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    } else if (period === 'year') {
      fromDate = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    }

    // Helper function to add order_type filter to WHERE clause
    const addOrderTypeFilter = (baseWhere = '') => {
      if (filterOrderType) {
        const typeFilter = ` AND order_type = '${filterOrderType}'`;
        return baseWhere + typeFilter;
      }
      return baseWhere;
    };

    // Run all queries in parallel for performance
    const [
      totalOrdersResult,
      pendingCountResult,
      inProgressCountResult,
      readyCountResult,
      deliveredCountResult,
      totalRevenueResult,
      pendingRevenueResult,
      todayDeliveries,
      overdueOrders,
      weeklyRevenue,
      topCustomers,
      totalCustomersResult,
      newCustomersResult,
      stitchingStatsResult,
      alterationStatsResult,
    ] = await Promise.all([
      // Total orders
      db.queryRow(`SELECT COUNT(*) as count FROM orders WHERE shop_id = $1${addOrderTypeFilter()}`, [shopId]),
      // Pending count
      db.queryRow(`SELECT COUNT(*) as count FROM orders WHERE shop_id = $1 AND status = 'pending'${addOrderTypeFilter()}`, [shopId]),
      // In progress count
      db.queryRow(`SELECT COUNT(*) as count FROM orders WHERE shop_id = $1 AND status = 'in_progress'${addOrderTypeFilter()}`, [shopId]),
      // Ready count
      db.queryRow(`SELECT COUNT(*) as count FROM orders WHERE shop_id = $1 AND status = 'ready'${addOrderTypeFilter()}`, [shopId]),
      // Delivered count
      db.queryRow(`SELECT COUNT(*) as count FROM orders WHERE shop_id = $1 AND status = 'delivered'${addOrderTypeFilter()}`, [shopId]),
      // Total revenue (delivered orders)
      db.queryRow(
        `SELECT COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE shop_id = $1 AND status = 'delivered'${addOrderTypeFilter()}`,
        [shopId]
      ),
      // Pending revenue
      db.queryRow(
        `SELECT COALESCE(SUM(balance_due), 0) as revenue FROM orders WHERE shop_id = $1 AND status != 'delivered'${addOrderTypeFilter()}`,
        [shopId]
      ),
      // Today's deliveries
      db.queryAll(
        `SELECT id, customer_id, total_amount, status, delivery_date FROM orders WHERE shop_id = $1 AND delivery_date = $2 AND status != 'delivered'${addOrderTypeFilter()} LIMIT 10`,
        [shopId, today]
      ),
      // Overdue orders
      db.queryAll(
        `SELECT id, customer_id, total_amount, status, delivery_date FROM orders WHERE shop_id = $1 AND delivery_date < $2 AND status != 'delivered'${addOrderTypeFilter()} LIMIT 10`,
        [shopId, today]
      ),
      // Weekly revenue
      db.queryAll(
        `SELECT DATE(created_at) as date, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders FROM orders WHERE shop_id = $1 AND created_at >= NOW() - INTERVAL '7 days'${addOrderTypeFilter()} GROUP BY DATE(created_at) ORDER BY date ASC`,
        [shopId]
      ),
      // Top customers
      db.queryAll(
        `SELECT c.id, c.name, c.phone, COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount), 0) as total_revenue FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE c.shop_id = $1 GROUP BY c.id, c.name, c.phone ORDER BY total_revenue DESC LIMIT 5`,
        [shopId]
      ),
      // Total customers
      db.queryRow(`SELECT COUNT(*) as count FROM customers WHERE shop_id = $1`, [shopId]),
      // New customers this month
      db.queryRow(
        `SELECT COUNT(*) as count FROM customers WHERE shop_id = $1 AND created_at >= $2`,
        [shopId, fromDate]
      ),
      // Stitching stats (always unfiltered by order_type, but filtered by period)
      db.queryRow(
        `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE shop_id = $1 AND order_type = 'stitching' AND created_at >= $2`,
        [shopId, fromDate]
      ),
      // Alteration stats (always unfiltered by order_type, but filtered by period)
      db.queryRow(
        `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE shop_id = $1 AND order_type = 'alteration' AND created_at >= $2`,
        [shopId, fromDate]
      ),
    ]);

    const stats = {
      period,
      order_type: filterOrderType,
      totalOrders: parseInt(totalOrdersResult?.count || 0),
      orderCounts: {
        pending: parseInt(pendingCountResult?.count || 0),
        in_progress: parseInt(inProgressCountResult?.count || 0),
        ready: parseInt(readyCountResult?.count || 0),
        delivered: parseInt(deliveredCountResult?.count || 0),
      },
      totalRevenue: parseFloat(totalRevenueResult?.revenue || 0),
      pendingRevenue: parseFloat(pendingRevenueResult?.revenue || 0),
      totalPayments: parseFloat(totalRevenueResult?.revenue || 0), // Assuming totalPayments is totalRevenue for now
      totalCustomers: parseInt(totalCustomersResult?.count || 0),
      newCustomers: parseInt(newCustomersResult?.count || 0),
      pastDue: overdueOrders.length, // Assuming pastDue is count of overdue orders
      stitchingStats: {
        count: parseInt(stitchingStatsResult?.count || 0),
        revenue: parseFloat(stitchingStatsResult?.revenue || 0),
      },
      alterationStats: {
        count: parseInt(alterationStatsResult?.count || 0),
        revenue: parseFloat(alterationStatsResult?.revenue || 0),
      },
      todayDeliveries,
      trialsToday: [], // Assuming trialsToday is empty or not implemented
      overdueOrders,
      weeklyRevenue: weeklyRevenue.map(row => ({
        date: row.date,
        revenue: parseFloat(row.revenue),
        orders: parseInt(row.orders),
      })),
      topCustomers: topCustomers.map(row => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        orderCount: parseInt(row.order_count),
        totalRevenue: parseFloat(row.total_revenue),
      })),
    };

    logger.info(`Dashboard stats retrieved for shop: ${shopId}`);
    responder.success(res, 200, 'Dashboard stats retrieved', stats);
  } catch (error) {
    logger.error('Get dashboard stats error:', error.message);
    responder.error(res, 500, 'Failed to get dashboard stats', error.message);
  }
};
