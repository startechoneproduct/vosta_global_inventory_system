const express = require('express');
const { ActivityLog } = require('../models/index.js');
const { verifyToken, resolveStoreScope } = require('../middleware/auth.js');

const router = express.Router();

// ============ LIST ACTIVITY LOG ============
// GM/Owner see everyone's activity. Manager/Accountant/Driver only see
// their own activity log, per spec ("the manager should also get to see
// his activity log").
router.get('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { startDate, endDate, productId } = req.query;
    const query = { storeId: req.storeId };

    const isGm = req.user.role === 'owner' || req.user.role === 'general_manager';
    if (!isGm) query.performedBy = req.user.userId;

    if (productId) query.productId = productId;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const logs = await ActivityLog.find(query)
      .populate('performedBy', 'fullName role')
      .sort({ date: -1 })
      .limit(500);

    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
