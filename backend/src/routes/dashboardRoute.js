const express = require('express');
const mongoose = require('mongoose');
const { Sale, Product, Return, Damage, Customer, DriverLocation, ActivityLog, Store, RawMaterial, ProductionBatch } = require('../models');
const { verifyToken, resolveStoreScope } = require('../middleware/auth');
const { rangeFor, computeProfitMetrics, computeInventoryOverview } = require('../utils/analytics');

const router = express.Router();

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ============ PRODUCTION SUMMARY (Stacey Fountain only) ============
// Fountain-only raw-material stock + production totals, shared by both the
// GM and manager/accountant dashboards. `includeMaterials` is only true for
// the GM view - manager/accountant already see the full materials list on
// the Production page itself, so their dashboard only needs the totals.
async function buildProductionSummary(storeId, isFarm, start, end, { includeMaterials }) {
  if (isFarm) return null;

  const [materials, batches] = await Promise.all([
    includeMaterials ? RawMaterial.find({ storeId, isActive: true }) : Promise.resolve([]),
    ProductionBatch.find({ storeId, timestamp: { $gte: start, $lte: end } }),
  ]);

  const bottledBatches = batches.filter((b) => b.productLine === 'bottled');
  const sachetBatches = batches.filter((b) => b.productLine === 'sachet');

  return {
    rawMaterials: materials.map((m) => ({
      materialKey: m.materialKey,
      name: m.name,
      purchaseUnitName: m.purchaseUnitName,
      currentStockPurchaseUnits: m.currentStockPurchaseUnits,
      currentStockPieces: m.currentStockPurchaseUnits * m.piecesPerPurchaseUnit,
      lowStock: m.currentStockPurchaseUnits <= m.minThresholdPurchaseUnits,
    })),
    bottled: {
      bottlesProducedPeriod: bottledBatches.reduce((sum, b) => sum + b.bottlesProduced, 0),
      packsProducedPeriod: bottledBatches.reduce((sum, b) => sum + b.packsProduced, 0),
      preformLeakageCountPeriod: bottledBatches.reduce((sum, b) => sum + b.preformLeakageCount, 0),
    },
    sachet: {
      sachetsProducedPeriod: sachetBatches.reduce((sum, b) => sum + b.sachetsProduced, 0),
      bagsProducedPeriod: sachetBatches.reduce((sum, b) => sum + b.bagsProduced, 0),
      sachetLeakageCountPeriod: sachetBatches.reduce((sum, b) => sum + b.sachetLeakageCount, 0),
    },
  };
}

// ============ GM / OWNER DASHBOARD ============
async function buildGmDashboard(storeId, period) {
  const { start, end } = rangeFor(period);
  const todayStart = startOfToday();

  // NEW: need the store's type to decide whether "loss" means customer
  // Returns (Fountain) or write-off Damages (Farm).
  const store = await Store.findById(storeId);
  const isFarm = store?.type === 'farm';

  const [todaySales, products, profitMetrics, inventoryOverview] = await Promise.all([
    Sale.find({ storeId, timestamp: { $gte: todayStart } }),
    Product.find({ storeId }),
    computeProfitMetrics(storeId, isFarm, start, end),
    computeInventoryOverview(storeId, start, end),
  ]);

  const { rangeSales, expenses, revenue, cogs, writeOffValue, writeOffLabel, approvedExpenseTotal, grossProfit, netProfit, totalExpense } = profitMetrics;

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

  const profit = netProfit > 0 ? netProfit : 0;
  const loss = netProfit < 0 ? Math.abs(netProfit) : 0;

  // Expense breakdown (pie chart data)
  const expenseByCategory = {};
  for (const e of expenses) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
  }
  const expensePieChart = Object.entries(expenseByCategory).map(([category, total]) => ({ category, total }));

  const [productionSummary, returnsInPeriod, damagesInPeriod] = await Promise.all([
    buildProductionSummary(storeId, isFarm, start, end, { includeMaterials: true }),
    isFarm ? Promise.resolve([]) : Return.find({ storeId, timestamp: { $gte: start, $lte: end } }),
    isFarm ? Damage.find({ storeId, timestamp: { $gte: start, $lte: end } }) : Promise.resolve([]),
  ]);
  const writeOffCount = isFarm ? damagesInPeriod.length : returnsInPeriod.length;

  return {
    period,
    storeType: store?.type,
    productionSummary,
    inventoryOverview,
    totalSalesToday,
    salesTrend,
    totalStock,
    lowStockProducts,
    bestSellers,
    stockHealthByProduct,
    profit,
    loss,
    profitBreakdown: {
      revenue,
      // Generic label for the frontend to use regardless of store type -
      // "Returns Value" for Fountain, "Damage Write-Off" for Farm.
      writeOffValue,
      writeOffLabel,
      costOfGoodsSold: cogs,
      approvedExpenses: approvedExpenseTotal,
      grossProfit,
      netProfit,
    },
    totalExpense,
    expensePieChart,
    // Generic count field, labeled appropriately by the frontend based on storeType.
    writeOffCount,
    // Kept for backward compatibility with the existing Fountain dashboard UI.
    returnsCount: writeOffCount,
  };
}

// ============ MANAGER / ACCOUNTANT / SUPERVISOR DASHBOARD ============
async function buildManagerDashboard(storeId, period) {
  const { start, end } = rangeFor(period);
  const todayStart = startOfToday();

  const store = await Store.findById(storeId);
  const isFarm = store?.type === 'farm';

  const [todaySales, rangeSales, products, writeOffCount, inventoryOverview] = await Promise.all([
    Sale.find({ storeId, timestamp: { $gte: todayStart } }),
    Sale.find({ storeId, timestamp: { $gte: start, $lte: end } }),
    Product.find({ storeId }),
    isFarm
      ? Damage.countDocuments({ storeId, timestamp: { $gte: start, $lte: end } })
      : Return.countDocuments({ storeId, timestamp: { $gte: start, $lte: end } }),
    computeInventoryOverview(storeId, start, end),
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

  const productionSummary = await buildProductionSummary(storeId, isFarm, start, end, { includeMaterials: false });

  return {
    period,
    storeType: store?.type,
    productionSummary,
    inventoryOverview,
    totalSalesToday,
    totalStock,
    returnsCount: writeOffCount,
    writeOffCount,
    stockTrend,
  };
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

  // $match in an aggregation pipeline doesn't auto-cast strings to ObjectId
  // the way find()/findOne() do, so the driverId (a string off the JWT) has
  // to be cast explicitly or this always matches zero documents.
  const driverObjectId = new mongoose.Types.ObjectId(driverId);
  const sumDistance = async (since) => {
    const result = await DriverLocation.aggregate([
      { $match: { driverId: driverObjectId, recordedAt: { $gte: since } } },
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
    } else if (['manager', 'accountant', 'supervisor'].includes(req.user.role)) {
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
