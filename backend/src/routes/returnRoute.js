const express = require('express');
const { Return, Product, StockMovement, ActivityLog } = require('../models');
const { verifyToken, resolveStoreScope } = require('../middleware/auth');
const { notifyStoreLeadership } = require('../utils/notify');

const router = express.Router();

// ============ RECORD A RETURN ============
router.post('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { productId, quantity, reason, customerId, restock = true } = req.body;
    const storeId = req.storeId;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'productId and positive quantity are required' });
    }

    const product = await Product.findOne({ _id: productId, storeId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const ret = await Return.create({
      storeId,
      productId,
      productName: product.name,
      quantity,
      reason,
      customerId,
      recordedBy: req.user.userId,
      recordedByRole: req.user.role,
      restocked: restock,
    });

    if (restock) {
      await Product.findByIdAndUpdate(productId, { $inc: { currentStock: quantity } });
      await StockMovement.create({
        storeId,
        productId,
        type: 'return_in',
        quantity,
        recordedBy: req.user.userId,
        notes: `Return: ${reason || 'no reason given'}`,
        timestamp: new Date(),
      });
    }

    await ActivityLog.create({
      storeId,
      productId,
      productName: product.name,
      quantity,
      action: 'returned',
      performedBy: req.user.userId,
      performedByName: req.user.fullName || req.user.email,
    });

    notifyStoreLeadership({
      storeId,
      includeManagers: false,
      type: 'return_recorded',
      title: `Return recorded: ${product.name}`,
      message: `${quantity} unit(s) of ${product.name} returned. Reason: ${reason || 'not specified'}.`,
      relatedId: ret._id,
    }).catch((e) => console.error('Return notification failed:', e.message));

    res.status(201).json({ success: true, message: 'Return recorded', data: ret });
  } catch (error) {
    next(error);
  }
});

// ============ LIST RETURNS ============
router.get('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { storeId: req.storeId };

    if (req.user.role === 'driver') query.recordedBy = req.user.userId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const returns = await Return.find(query)
      .populate('recordedBy', 'fullName role')
      .sort({ timestamp: -1 })
      .limit(300);

    res.json({ success: true, data: returns });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
