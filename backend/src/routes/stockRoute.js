const express = require('express');
const { Product, StockMovement } = require('../models/index.js');
const { verifyToken, resolveStoreScope, authorize } = require('../middleware/auth');
const { notifyStoreLeadership } = require('../utils/notify');

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

// ============ GET STOCK MOVEMENTS ============
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

    const movements = await StockMovement.find(query)
      .populate('productId', 'name sku')
      .sort({ timestamp: -1 })
      .limit(200);

    res.json({
      success: true,
      data: movements,
    });
  } catch (error) {
    next(error);
  }
});

// ============ INVENTORY ANALYTICS (stock health, levels) ============
router.get('/analytics', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const products = await Product.find({ storeId: req.storeId });

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
      data: { totalUnits, byStatus, products: productBreakdown },
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