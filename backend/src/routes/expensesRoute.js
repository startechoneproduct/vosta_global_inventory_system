const express = require('express');
const { verifyToken, authorize } = require('../middleware/auth');
const { Expense, Store } = require('../models');

const router = express.Router();

// ============ CREATE EXPENSE ============
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { category, amount, description } = req.body;
    const storeId = req.body.storeId || req.user.storeId;

    if (!category || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Category and positive amount required',
      });
    }

    // Get store to check approval threshold
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    // Auto-approve if below threshold
    const approvalStatus = amount <= store.config.expenseApprovalThreshold ? 'approved' : 'pending';

    const expense = await Expense.create({
      storeId,
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

// ============ GET EXPENSES ============
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { category, status, startDate, endDate } = req.query;
    const storeId = req.query.storeId || req.user.storeId;

    let query = {};
    if (storeId) query.storeId = storeId;
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
router.put('/:expenseId/approve', verifyToken, authorize('general_manager', 'owner'), async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndUpdate(
      req.params.expenseId,
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
