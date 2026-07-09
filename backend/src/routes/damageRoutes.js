const express = require('express');
const { Damage, Product, ActivityLog } = require('../models/index.js');
const { verifyToken, resolveStoreScope } = require('../middleware/auth.js');
const { notifyStoreLeadership } = require('../utils/notify.js');

const router = express.Router();

const REASONS = ['broken', 'cracked', 'rotten', 'contaminated', 'other'];


router.post('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { productId, quantity, reason, notes } = req.body;
    const storeId = req.storeId;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'productId and a positive quantity are required' });
    }

    const product = await Product.findOne({ _id: productId, storeId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (product.currentStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Cannot write off more than is in stock. Available: ${product.currentStock}, Requested: ${quantity}`,
      });
    }

    const resolvedReason = REASONS.includes(reason) ? reason : 'other';
    const costValue = (product.costPerUnit || 0) * quantity;

    
    await Product.findByIdAndUpdate(productId, { $inc: { currentStock: -quantity } });

    const damage = await Damage.create({
      storeId,
      productId,
      productName: product.name,
      quantity,
      reason: resolvedReason,
      costValue,
      recordedBy: req.user.userId,
      recordedByRole: req.user.role,
      notes,
    });

    await ActivityLog.create({
      storeId,
      productId,
      productName: product.name,
      quantity,
      action: 'stock_out',
      performedBy: req.user.userId,
      performedByName: req.user.fullName || req.user.email,
    });

    notifyStoreLeadership({
      storeId,
      includeManagers: true,
      type: 'general',
      title: `Damage recorded: ${product.name}`,
      message: `${quantity} unit(s) of ${product.name} written off (${resolvedReason}). Estimated loss: ₦${(costValue / 100).toFixed(2)}.`,
      relatedId: damage._id,
    }).catch((e) => console.error('Damage notification failed:', e.message));

    res.status(201).json({ success: true, message: 'Damage recorded and stock updated', data: damage });
  } catch (error) {
    next(error);
  }
});

// ============ LIST DAMAGES ============
router.get('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { startDate, endDate, reason } = req.query;
    const query = { storeId: req.storeId };

    if (reason) query.reason = reason;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const damages = await Damage.find(query)
      .populate('recordedBy', 'fullName role')
      .sort({ timestamp: -1 })
      .limit(300);

    res.json({ success: true, data: damages });
  } catch (error) {
    next(error);
  }
});

module.exports = router;