const express = require('express');
const { Product, StockMovement, Store } = require('../models/index.js');
const { verifyToken, resolveStoreScope, authorize } = require('../middleware/auth');
const { notifyStoreLeadership } = require('../utils/notify');
const { rangeFor, computeInventoryOverview } = require('../utils/analytics');

const router = express.Router();

const canEditStock = authorize('owner', 'general_manager', 'accountant');

// ============ STOCK IN ============
router.post('/in', verifyToken, resolveStoreScope, canEditStock, async (req, res, next) => {
  try {
    const { productId, quantity, notes } = req.body;
    const storeId = req.storeId;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and positive quantity required',
      });
    }

    const product = await Product.findOne({ _id: productId, storeId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Update stock
    const updated = await Product.findByIdAndUpdate(
      productId,
      { $inc: { currentStock: quantity } },
      { new: true }
    );

    // Create stock movement log
    await StockMovement.create({
      storeId,
      productId,
      type: 'in',
      quantity,
      balanceAfter: updated.currentStock,
      recordedBy: req.user.userId,
      notes,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: `Added ${quantity} units to ${product.name}`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// ============ STOCK OUT ============
router.post('/out', verifyToken, resolveStoreScope, canEditStock, async (req, res, next) => {
  try {
    const { productId, quantity, notes } = req.body;
    const storeId = req.storeId;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and positive quantity required',
      });
    }

    const product = await Product.findOne({ _id: productId, storeId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (product.currentStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.currentStock}, Requested: ${quantity}`,
      });
    }

    // Update stock
    const updated = await Product.findByIdAndUpdate(
      productId,
      { $inc: { currentStock: -quantity } },
      { new: true }
    );

    // Create stock movement log
    await StockMovement.create({
      storeId,
      productId,
      type: 'out',
      quantity,
      balanceAfter: updated.currentStock,
      recordedBy: req.user.userId,
      notes,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: `Removed ${quantity} units from ${product.name}`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// ============ MANUAL PAST-SALE / HISTORICAL STOCK ENTRY ============
// This is the endpoint your Inventory page's "Manual Past-Sale Entry" tab
// calls. It was missing entirely from the original file - that's what was
// causing the "endpoint not found" error.
router.post('/manual-past-sale', verifyToken, resolveStoreScope, canEditStock, async (req, res, next) => {
  try {
    const { productId, quantity, manualEntryDate, notes } = req.body;
    const storeId = req.storeId;

    if (!productId || !quantity || quantity <= 0 || !manualEntryDate) {
      return res.status(400).json({
        success: false,
        message: 'productId, quantity and manualEntryDate are required',
      });
    }

    const product = await Product.findOne({ _id: productId, storeId });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const movement = await StockMovement.create({
      storeId,
      productId,
      type: 'manual_past_sale',
      quantity,
      recordedBy: req.user.userId,
      notes: notes || 'Manually entered historical sale',
      manualEntryDate: new Date(manualEntryDate),
      timestamp: new Date(manualEntryDate),
    });

    res.status(201).json({
      success: true,
      message: 'Historical sale recorded',
      data: movement,
    });
  } catch (error) {
    next(error);
  }
});

// ============ GET PRODUCTS WITH STOCK ============
router.get('/products', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const products = await Product.find({ storeId: req.storeId }).sort({ name: 1 });

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
});

// ============ GET STOCK MOVEMENTS (Inventory Movement ledger) ============
router.get('/movements', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { productId, type, startDate, endDate } = req.query;

    let query = { storeId: req.storeId };
    if (productId) query.productId = productId;
    if (type) query.type = type;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const [movements, store] = await Promise.all([
      StockMovement.find(query)
        .populate('productId', 'name sku')
        .populate('recordedBy', 'fullName role')
        .sort({ timestamp: -1 })
        .limit(200),
      Store.findById(req.storeId),
    ]);

    // Simplified IN/OUT label for the Inventory Movement table, alongside
    // the raw type so the UI can show something more specific if it wants to.
    const IN_TYPES = ['in', 'return_in', 'production_in'];
    const data = movements.map((m) => ({
      ...m.toObject(),
      direction: IN_TYPES.includes(m.type) ? 'in' : 'out',
      storeName: store?.name,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// ============ INVENTORY ANALYTICS (stock health, levels, overview) ============
router.get('/analytics', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { period = '30days' } = req.query;
    // Overview cards (stock in/out, turnover, etc.) are computed for a
    // period; the byStatus/products breakdown below is a point-in-time
    // snapshot regardless of period, matching prior behavior.
    const days = period === '7days' ? 7 : period === '1year' ? 365 : 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

    const [products, overview] = await Promise.all([
      Product.find({ storeId: req.storeId }),
      computeInventoryOverview(req.storeId, start, end),
    ]);

    const byStatus = { healthy: 0, low_stock: 0, out_of_stock: 0 };
    const totalUnits = products.reduce((sum, p) => sum + p.currentStock, 0);

    const productBreakdown = products.map((p) => {
      const status = p.currentStock <= 0 ? 'out_of_stock' : p.currentStock <= p.minThreshold ? 'low_stock' : 'healthy';
      byStatus[status] += 1;
      return {
        productId: p._id,
        name: p.name,
        currentStock: p.currentStock,
        minThreshold: p.minThreshold,
        status,
      };
    });

    res.json({
      success: true,
      data: {
        totalUnits,
        byStatus,
        products: productBreakdown,
        overview,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============ HELPER: LOW STOCK CHECK + NOTIFY ============
// This is what salesRoute.js is trying to import via `require('./stockRoute.js').helpers`.
// It was missing from your file entirely, which is why you got:
// "Cannot destructure property 'checkLowStockAndNotify' ... as it is undefined"
async function checkLowStockAndNotify(storeId) {
  const lowStockProducts = await Product.find({
    storeId,
    $expr: { $lte: ['$currentStock', '$minThreshold'] },
  });

  if (lowStockProducts.length === 0) return;

  const names = lowStockProducts.map((p) => `${p.name} (${p.currentStock} left)`).join(', ');

  await notifyStoreLeadership({
    storeId,
    includeManagers: true,
    type: 'low_stock',
    title: 'Low stock alert',
    message: `The following products are low on stock: ${names}.`,
  });
}

// ============ MANUAL TRIGGER (test email delivery on demand) ============
router.post('/check-low-stock-now', verifyToken, resolveStoreScope, canEditStock, async (req, res, next) => {
  try {
    await checkLowStockAndNotify(req.storeId);
    res.json({ success: true, message: 'Low stock check complete. Notifications sent if any products are low.' });
  } catch (error) {
    next(error);
  }
});

// This line is what makes `.helpers` exist on the exported router - it's
// how other route files (salesRoute.js) can borrow this function.
router.helpers = { checkLowStockAndNotify };

module.exports = router;