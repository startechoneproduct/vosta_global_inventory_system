const express = require('express');
const { verifyToken, authorize, resolveStoreScope } = require('../middleware/auth');
const { Expense, Store } = require('../models');

const router = express.Router();

// Which expense categories are valid for which store type. "Salaries",
// "Maintenance" and "Misc" are generic and shared across both; the rest are
// store-specific (Fountain's bottling-line supplies vs Farm's feed/medication).
const FOUNTAIN_CATEGORIES = ['Fuel', 'Caps', 'Bottle Preforms', 'Nylon', 'Filters', 'AEDC', 'Labels', 'Salaries', 'Maintenance', 'Misc'];
const FARM_CATEGORIES = ['Layer Mash', 'Grower Mash', 'Feeds', 'Vaccination', 'Medication', 'Day-Old Chicks', 'Salaries', 'Maintenance', 'Misc'];

function categoriesForStoreType(storeType) {
  return storeType === 'farm' ? FARM_CATEGORIES : FOUNTAIN_CATEGORIES;
}

// ============ CREATE EXPENSE ============
router.post('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { category, amount, description } = req.body;

    if (!category || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Category and positive amount required',
      });
    }

    // Get store to check approval threshold
    const store = await Store.findById(req.storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const allowedCategories = categoriesForStoreType(store.type);
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `"${category}" is not a valid expense category for ${store.type === 'farm' ? 'Stacey Farm' : 'Stacey Fountain'}`,
      });
    }

    // Auto-approve if below threshold
    const approvalStatus = amount <= store.config.expenseApprovalThreshold ? 'approved' : 'pending';

    const expense = await Expense.create({
      storeId: req.storeId,
      category,
      amount,
      description,
      recordedBy: req.user.userId,
      approvalStatus,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: `Expense recorded. Status: ${approvalStatus}`,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
});

// ============ GET EXPENSE CATEGORIES FOR THE ACTIVE STORE ============
router.get('/categories', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const store = await Store.findById(req.storeId);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });
    res.json({ success: true, data: categoriesForStoreType(store.type) });
  } catch (error) {
    next(error);
  }
});

// ============ GET EXPENSES ============
router.get('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { category, status, startDate, endDate } = req.query;

    let query = { storeId: req.storeId };
    if (category) query.category = category;
    if (status) query.approvalStatus = status;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(query)
      .sort({ timestamp: -1 })
      .limit(200);

    res.json({
      success: true,
      data: expenses,
    });
  } catch (error) {
    next(error);
  }
});

// ============ APPROVE EXPENSE ============
router.put('/:expenseId/approve', verifyToken, resolveStoreScope, authorize('general_manager', 'owner'), async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.expenseId, storeId: req.storeId },
      { approvalStatus: 'approved', approvedBy: req.user.userId },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
      });
    }

    res.json({
      success: true,
      message: 'Expense approved',
      data: expense,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
