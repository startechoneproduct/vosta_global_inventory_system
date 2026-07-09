const express = require('express');
const { Store, User } = require('../models');
const { verifyToken, authorize } = require('../middleware/auth');

const router = express.Router();

// ============ LIST STORES THE CURRENT USER CAN ACCESS ============
// Only owners get the multi-store dropdown; everyone else is locked to
// their single assigned store, but we still return it here for the UI.
router.get('/', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role === 'owner') {
      const user = await User.findById(req.user.userId);
      const query =
        user.accessibleStoreIds && user.accessibleStoreIds.length > 0
          ? { _id: { $in: user.accessibleStoreIds } }
          : {}; // unrestricted owner sees all stores

      const stores = await Store.find(query).sort({ name: 1 });
      return res.json({ success: true, data: stores, canSwitch: true });
    }

    const store = await Store.findById(req.user.storeId);
    res.json({ success: true, data: store ? [store] : [], canSwitch: false });
  } catch (error) {
    next(error);
  }
});

// ============ GET SINGLE STORE CONFIG ============
router.get('/:storeId', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.canAccessStore(req.params.storeId)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this store.' });
    }

    const store = await Store.findById(req.params.storeId);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });
    res.json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
});

// ============ UPDATE STORE CONFIG (owner only) ============
router.put('/:storeId', verifyToken, authorize('owner'), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.canAccessStore(req.params.storeId)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this store.' });
    }

    const { config } = req.body;
    const store = await Store.findByIdAndUpdate(req.params.storeId, { config }, { new: true });
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });
    res.json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
