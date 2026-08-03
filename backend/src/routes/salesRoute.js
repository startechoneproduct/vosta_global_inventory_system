const express = require('express');
const { Product, Sale, ActivityLog, Customer, StockMovement } = require('../models/index.js');
const { verifyToken, resolveStoreScope } = require('../middleware/auth');
const { checkLowStockAndNotify } = require('./stockRoute.js').helpers;
const { applyPurchaseToCustomerTokens } = require('./customersRoute.js').helpers;
const { rangeFor } = require('../utils/analytics');

const router = express.Router();

// ============ CREATE SALE ============
router.post('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { items, paymentMethod, customerId } = req.body;
    const storeId = req.storeId;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Sales must have at least one item' });
    }

    // Validate stock + build enriched item list (server is source of truth
    // for productName and default price; managers cannot override price).
    const enrichedItems = [];
    let totalAmount = 0;
    let costOfGoods = 0;
    let priceOverridden = false;

    for (const item of items) {
      if (!item.productId || !item.quantity || Number(item.quantity) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Each sale item needs a product and a quantity greater than 0',
        });
      }

      const product = await Product.findOne({ _id: item.productId, storeId });
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.productId} not found in this store` });
      }
      if (product.currentStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.currentStock}, Requested: ${item.quantity}`,
        });
      }

      // Only owner / general_manager may sell at a price different from
      // the catalog price. Everyone else always sells at pricePerUnit.
      const isGm = req.user.role === 'owner' || req.user.role === 'general_manager';
      let unitPrice = product.pricePerUnit;
      if (isGm && item.pricePerUnit && item.pricePerUnit !== product.pricePerUnit) {
        unitPrice = item.pricePerUnit;
        priceOverridden = true;
      }

      const lineTotal = unitPrice * item.quantity;
      totalAmount += lineTotal;
      costOfGoods += (product.costPerUnit || 0) * item.quantity;

      enrichedItems.push({
        productId: product._id,
        productName: product.name,
        quantity: item.quantity,
        pricePerUnit: unitPrice,
        total: lineTotal,
      });
    }

    // Defensive final check - should be unreachable given the per-item
    // guard above, but fails loudly with a specific message rather than
    // letting Mongoose's generic "totalAmount is required" bubble up.
    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Could not compute a valid sale total from the given items. Check product prices are set correctly.',
      });
    }

    // Deduct stock, logging each line as a StockMovement so it shows up in
    // the Inventory Movement ledger and in stock-out totals.
    for (const item of enrichedItems) {
      const updated = await Product.findByIdAndUpdate(item.productId, { $inc: { currentStock: -item.quantity } }, { new: true });
      await StockMovement.create({
        storeId,
        productId: item.productId,
        type: 'sale',
        quantity: item.quantity,
        balanceAfter: updated?.currentStock,
        recordedBy: req.user.userId,
        notes: `Sale`,
      });
    }

    const sale = await Sale.create({
      storeId,
      items: enrichedItems,
      totalAmount,
      costOfGoods,
      paymentMethod,
      customerId: customerId || undefined,
      recordedBy: req.user.userId,
      priceOverridden,
      timestamp: new Date(),
    });

    // Activity log: one entry per product sold
    await ActivityLog.insertMany(
      enrichedItems.map((item) => ({
        storeId,
        saleId: sale._id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        action: 'sold',
        performedBy: req.user.userId,
        performedByName: req.user.fullName || req.user.email,
        date: sale.timestamp,
      }))
    );

    // Update customer token rewards, if this sale is tied to a customer
    // (typically populated from a driver's own recorded sales/deliveries)
    if (customerId) {
      await applyPurchaseToCustomerTokens(customerId, enrichedItems);
    }

    // Fire-and-forget low stock check (does not block the sale response)
    checkLowStockAndNotify(storeId).catch((e) => console.error('Low stock check failed:', e.message));

    res.status(201).json({ success: true, message: 'Sale recorded successfully', data: sale });
  } catch (error) {
    next(error);
  }
});

// ============ GET SALES (with product name column already included) ============
router.get('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { startDate, endDate, paymentMethod } = req.query;
    const query = { storeId: req.storeId };

    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const sales = await Sale.find(query)
      .populate('recordedBy', 'fullName role')
      .sort({ timestamp: -1 })
      .limit(200);

    res.json({ success: true, data: sales });
  } catch (error) {
    next(error);
  }
});

// ============ SALES OVERVIEW ANALYTICS ============
// NOTE: must be registered before GET /:saleId or Express will treat
// "analytics" as a saleId.
router.get('/analytics', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { period = '7days' } = req.query;
    const { start, end } = rangeFor(period);
    const storeId = req.storeId;

    const [rangeSales, products] = await Promise.all([
      Sale.find({ storeId, timestamp: { $gte: start, $lte: end } }),
      Product.find({ storeId }),
    ]);

    const categoryByProductId = {};
    for (const p of products) categoryByProductId[p._id.toString()] = p.category || 'Uncategorized';

    const totalSales = rangeSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCost = rangeSales.reduce((sum, s) => sum + (s.costOfGoods || 0), 0);
    const totalProfit = totalSales - totalCost;
    const avgSaleValue = rangeSales.length > 0 ? totalSales / rangeSales.length : 0;

    const trendMap = {};
    const unitsByProduct = {};
    const transactionsByProduct = {};
    const revenueByCategory = {};

    for (const sale of rangeSales) {
      const day = sale.timestamp.toISOString().slice(0, 10);
      trendMap[day] = (trendMap[day] || 0) + sale.totalAmount;

      for (const item of sale.items) {
        unitsByProduct[item.productName] = (unitsByProduct[item.productName] || 0) + item.quantity;
        transactionsByProduct[item.productName] = (transactionsByProduct[item.productName] || 0) + 1;

        const category = categoryByProductId[item.productId?.toString()] || 'Uncategorized';
        revenueByCategory[category] = (revenueByCategory[category] || 0) + item.total;
      }
    }

    const salesTrend = Object.entries(trendMap)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([date, total]) => ({ date, total }));

    const productsByUnitsSold = Object.entries(unitsByProduct).sort((a, b) => b[1] - a[1]);
    const topSellingProducts = productsByUnitsSold.slice(0, 5).map(([productName, unitsSold]) => ({ productName, unitsSold }));
    const bottomSellingProducts = productsByUnitsSold
      .slice(-5)
      .reverse()
      .map(([productName, unitsSold]) => ({ productName, unitsSold }));

    const transactionCountByProduct = Object.entries(transactionsByProduct)
      .sort((a, b) => b[1] - a[1])
      .map(([productName, count]) => ({ productName, count }));

    const revenueByCategoryChart = Object.entries(revenueByCategory).map(([category, total]) => ({ category, total }));

    res.json({
      success: true,
      data: {
        period,
        totalSales,
        totalProfit,
        totalCost,
        avgSaleValue,
        transactionCount: rangeSales.length,
        salesTrend,
        topSellingProducts,
        bottomSellingProducts,
        transactionCountByProduct,
        revenueByCategory: revenueByCategoryChart,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============ GET SINGLE SALE ============
router.get('/:saleId', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.saleId, storeId: req.storeId });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json({ success: true, data: sale });
  } catch (error) {
    next(error);
  }
});

module.exports = router;