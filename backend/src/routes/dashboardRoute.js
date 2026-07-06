const express = require('express');
const { Sale, Product, Expense, Return, Customer, DriverLocation, ActivityLog } = require('../models');
const { verifyToken, resolveStoreScope } = require('../middleware/auth');

const router = express.Router();

const PERIOD_TO_DAYS = { '2days': 2, '7days': 7, '1week': 7, '1month': 30, '1year': 365 };

function rangeFor(period) {
  const days = PERIOD_TO_DAYS[period] || 1; // default: today
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ============ GM / OWNER DASHBOARD ============
async function buildGmDashboard(storeId, period) {
  const { start, end } = rangeFor(period);
  const todayStart = startOfToday();

  const [todaySales, rangeSales, products, expenses, returnsInPeriod] = await Promise.all([
    Sale.find({ storeId, timestamp: { $gte: todayStart } }),
    Sale.find({ storeId, timestamp: { $gte: start, $lte: end } }),
    Product.find({ storeId }),
    Expense.find({ storeId, timestamp: { $gte: start, $lte: end } }),
    Return.find({ storeId, timestamp: { $gte: start, $lte: end } }),
  ]);

  const totalSalesToday = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

  // Sales trend bucketed by day across the selected period
  const trendMap = {};
  for (const sale of rangeSales) {
    const day = sale.timestamp.toISOString().slice(0, 10);
    trendMap[day] = (trendMap[day] || 0) + sale.totalAmount;
  }
  const salesTrend = Object.entries(trendMap)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, total]) => ({ date, total }));

  // Total stock across all products
  const totalStock = products.reduce((sum, p) => sum + p.currentStock, 0);

  // Low stock alerts
  const lowStockProducts = products
    .filter((p) => p.currentStock <= p.minThreshold)
    .map((p) => ({ productId: p._id, name: p.name, currentStock: p.currentStock, minThreshold: p.minThreshold }));

  // Stock health by product + best sellers (by units sold in range)
  const unitsSoldByProduct = {};
  for (const sale of rangeSales) {
    for (const item of sale.items) {
      unitsSoldByProduct[item.productName] = (unitsSoldByProduct[item.productName] || 0) + item.quantity;
    }
  }
  const bestSellers = Object.entries(unitsSoldByProduct)
    .sort((a, b) => b[1] - a[1])
    .map(([productName, unitsSold]) => ({ productName, unitsSold }));

  const stockHealthByProduct = products.map((p) => ({
    name: p.name,
    currentStock: p.currentStock,
    minThreshold: p.minThreshold,
    status: p.currentStock <= 0 ? 'out_of_stock' : p.currentStock <= p.minThreshold ? 'low_stock' : 'healthy',
    unitsSoldInPeriod: unitsSoldByProduct[p.name] || 0,
  }));

  // Profit / loss - profit = revenue - cost of goods - approved expenses.
  // NOTE: costOfGoods on Sale currently defaults to 0 unless populated
  // elsewhere; wire in your actual unit cost data to make this fully
  // accurate. Loss = expenses only exceeding revenue in the period, shown
  // for completeness even if usually 0 for a healthy period.
  const revenue = rangeSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const cogs = rangeSales.reduce((sum, s) => sum + (s.costOfGoods || 0), 0);

  const priceByProductId = {};
  for (const p of products) priceByProductId[p._id.toString()] = p.pricePerUnit;

  const returnsValue = returnsInPeriod.reduce((sum, r) => {
    const price = priceByProductId[r.productId?.toString()] || 0;
    return sum + price * r.quantity;
  }, 0);

  const approvedExpenseTotal = expenses.filter((e) => e.approvalStatus === 'approved').reduce((sum, e) => sum + e.amount, 0);

  const grossProfit = revenue - returnsValue - cogs;
  const netProfit = grossProfit - approvedExpenseTotal;

  const profit = netProfit > 0 ? netProfit : 0;
  const loss = netProfit < 0 ? Math.abs(netProfit) : 0;

  // Expense breakdown (pie chart data)
  const expenseByCategory = {};
  for (const e of expenses) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
  }
  const expensePieChart = Object.entries(expenseByCategory).map(([category, total]) => ({ category, total }));

  return {
    period,
    totalSalesToday,
    salesTrend,
    totalStock,
    lowStockProducts,
    bestSellers,
    stockHealthByProduct,
    profit,
    loss,
    profitBreakdown:{
      revenue,
      returnsValue,
      costOfGoods: cogs,
      approvedExpense: approvedExpenseTotal,
      grossProfit,
      netProfit,
    },
    totalExpense: expenses.reduce((sum, e) => sum + e.amount, 0),
    expensePieChart,
    returnsCount: returnsInPeriod.length,
  };
}

// ============ MANAGER / ACCOUNTANT DASHBOARD ============
async function buildManagerDashboard(storeId, period) {
  const { start, end } = rangeFor(period);
  const todayStart = startOfToday();

  const [todaySales, rangeSales, products, returnsCount] = await Promise.all([
    Sale.find({ storeId, timestamp: { $gte: todayStart } }),
    Sale.find({ storeId, timestamp: { $gte: start, $lte: end } }),
    Product.find({ storeId }),
    Return.countDocuments({ storeId, timestamp: { $gte: start, $lte: end } }),
  ]);

  const totalSalesToday = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalStock = products.reduce((sum, p) => sum + p.currentStock, 0);

  const trendMap = {};
  for (const sale of rangeSales) {
    const day = sale.timestamp.toISOString().slice(0, 10);
    trendMap[day] = (trendMap[day] || 0) + sale.totalAmount;
  }
  const stockTrend = Object.entries(trendMap)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, total]) => ({ date, total }));

  return { period, totalSalesToday, totalStock, returnsCount, stockTrend };
}

// ============ DRIVER DASHBOARD ============
async function buildDriverDashboard(storeId, driverId) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const countProductsSold = async (since) => {
    const logs = await ActivityLog.find({ storeId, performedBy: driverId, action: 'sold', date: { $gte: since } });
    return logs.reduce((sum, l) => sum + l.quantity, 0);
  };

  const sumDistance = async (since) => {
    const result = await DriverLocation.aggregate([
      { $match: { driverId, recordedAt: { $gte: since } } },
      { $group: { _id: null, total: { $sum: '$distanceCoveredKm' } } },
    ]);
    return result[0]?.total || 0;
  };

  const [customersCount, productsWeek, productsMonth, productsYear, distanceWeek, distanceMonth, distanceYear, returnsCount] =
    await Promise.all([
      Customer.countDocuments({ storeId, createdBy: driverId }),
      countProductsSold(weekAgo),
      countProductsSold(monthAgo),
      countProductsSold(yearAgo),
      sumDistance(weekAgo),
      sumDistance(monthAgo),
      sumDistance(yearAgo),
      Return.countDocuments({ storeId, recordedBy: driverId }),
    ]);

  return {
    customersCount,
    productsSold: { week: productsWeek, month: productsMonth, year: productsYear },
    distanceKm: { week: distanceWeek, month: distanceMonth, year: distanceYear },
    returnsCount,
  };
}

// ============ MAIN ROUTE ============
router.get('/summary', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { period = 'today' } = req.query;
    const isGm = req.user.role === 'owner' || req.user.role === 'general_manager';

    let data;
    if (isGm) {
      data = await buildGmDashboard(req.storeId, period);
    } else if (req.user.role === 'manager' || req.user.role === 'accountant') {
      data = await buildManagerDashboard(req.storeId, period);
    } else if (req.user.role === 'driver') {
      data = await buildDriverDashboard(req.storeId, req.user.userId);
    } else {
      data = await buildManagerDashboard(req.storeId, period);
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
